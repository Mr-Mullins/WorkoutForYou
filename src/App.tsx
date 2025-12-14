import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Admin from "./Admin";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import SignUpForm from "./SignUpForm";
import { supabase } from "./supabaseClient";
import UserAdmin from "./UserAdmin";
import "./App.css";

interface UserProfile {
	first_name?: string;
	last_name?: string;
	avatar_url?: string;
}

function UpdatePasswordForm() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		if (password !== confirmPassword) {
			setMessage("Passordene matcher ikke");
			return;
		}

		if (password.length < 6) {
			setMessage("Passordet må være minst 6 tegn");
			return;
		}

		setLoading(true);
		const { error } = await supabase.auth.updateUser({ password: password });

		if (error) {
			setMessage(`Feil: ${error.message}`);
			setLoading(false);
		} else {
			setMessage("Passord oppdatert! Du blir logget inn...");
			// Rydd opp URL-en
			window.history.replaceState(null, "", window.location.pathname);
			// Vent litt før redirect
			setTimeout(() => {
				window.location.reload();
			}, 1500);
		}
	};

	return (
		<div className="auth-container">
			<Card className="w-full max-w-md mx-auto">
				<CardHeader>
					<CardTitle>Sett nytt passord</CardTitle>
					<CardDescription>
						Vennligst skriv inn ditt nye passord nedenfor
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleUpdatePassword} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="password">Nytt passord:</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
								placeholder="Skriv inn nytt passord"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Bekreft passord:</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								minLength={6}
								placeholder="Bekreft nytt passord"
							/>
						</div>
						{message && (
							<Alert
								variant={message.includes("Feil") ? "destructive" : "default"}
							>
								<AlertDescription>{message}</AlertDescription>
							</Alert>
						)}
						<Button type="submit" disabled={loading} className="w-full">
							{loading ? "Oppdaterer..." : "Oppdater passord"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

function App() {
	const [session, setSession] = useState<Session | null>(null);
	const [showPasswordReset, setShowPasswordReset] = useState(false);
	const [showSignUp, setShowSignUp] = useState(false);
	const [currentView, setCurrentView] = useState<
		"dashboard" | "admin" | "profile"
	>("dashboard");
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

	// Enkel admin-sjekk basert på e-postadresse
	// Du kan endre dette til å bruke en admin-rolle i Supabase hvis du vil
	const isAdmin = (): boolean => {
		if (!session?.user?.email) return false;
		// Legg til din admin-e-postadresse her, eller sjekk mot en admin-tabell i Supabase
		const adminEmails: string[] = [
			// Legg til admin-e-postadresser her, f.eks:
			// 'admin@example.com'
		];
		return adminEmails.includes(session.user.email.toLowerCase());
	};

	useEffect(() => {
		// Sjekk om brukeren kommer fra en nullstillingslenke (sjekk URL hash)
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const type = hashParams.get("type");
		const accessToken = hashParams.get("access_token");

		if (type === "recovery" && accessToken) {
			setShowPasswordReset(true);
		}

		const loadSession = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setSession(session);
			if (session?.user) {
				fetchUserProfile(session.user.id);
			}
		};

		// Last session uansett om det er recovery link eller ikke
		loadSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			// Håndter passord-nullstilling
			if (event === "PASSWORD_RECOVERY") {
				setShowPasswordReset(true);
			}
			setSession(session);

			// Hent brukerprofil når session endres
			if (session?.user) {
				fetchUserProfile(session.user.id);
			}
		});

		return () => subscription.unsubscribe();
	}, [fetchUserProfile]);

	async function fetchUserProfile(userId: string) {
		try {
			// Prøv først å hente fra user_profiles tabell
			const { data, error } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("user_id", userId)
				.single();

			if (data) {
				// Håndter både avatar_url og avatar_URL (små og store bokstaver)
				const profileData: UserProfile = {
					...data,
					avatar_url: data.avatar_url || (data as any).avatar_URL || "",
				};
				setUserProfile(profileData);
				return;
			}

			// Hvis profil ikke finnes (PGRST116 = ingen rader funnet), hent fra user_metadata
			if (error?.code === "PGRST116") {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					const profile: UserProfile = {
						first_name: user.user_metadata?.first_name || "",
						last_name: user.user_metadata?.last_name || "",
						avatar_url: user.user_metadata?.avatar_url || "",
					};
					setUserProfile(profile);

					// Opprett profil i bakgrunnen (ikke blokker UI)
					(async () => {
						try {
							await supabase.from("user_profiles").insert({
								user_id: userId,
								...profile,
							});
						} catch (err: any) {
							console.error("Kunne ikke opprette profil:", err);
						}
					})();
				}
			} else if (error) {
				// Hvis det er en annen feil, logg den og prøv fallback
				console.error("Feil ved henting av profil:", error);
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					setUserProfile({
						first_name: user.user_metadata?.first_name || "",
						last_name: user.user_metadata?.last_name || "",
						avatar_url: user.user_metadata?.avatar_url || "",
					});
				}
			}
		} catch (error) {
			console.error("Feil ved henting av profil:", error);
			// Fallback til user_metadata ved uventet feil
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					setUserProfile({
						first_name: user.user_metadata?.first_name || "",
						last_name: user.user_metadata?.last_name || "",
						avatar_url: user.user_metadata?.avatar_url || "",
					});
				}
			} catch (fallbackError) {
				console.error("Fallback feilet også:", fallbackError);
			}
		}
	}

	// Hvis brukeren er på nullstillingssiden, vis passord-skjema
	if (showPasswordReset) {
		return <UpdatePasswordForm />;
	}

	useEffect(() => {
		// Fjern "Sign in with Email" knappen når Auth-komponenten er lastet
		const removeProviderButton = () => {
			const authWrapper = document.querySelector(".auth-wrapper");
			if (authWrapper) {
				// Finn alle buttons og sjekk om de er provider-knapper
				const buttons = authWrapper.querySelectorAll(
					'button[data-state="default"]',
				);
				buttons.forEach((button) => {
					const htmlButton = button as HTMLElement;
					const text =
						htmlButton.textContent || (htmlButton as any).innerText || "";
					// Kun fjern hvis det er "Sign in with Email" knappen
					if (
						text.toLowerCase().includes("sign in with email") ||
						(text.toLowerCase().includes("email") &&
							text.toLowerCase().includes("sign"))
					) {
						htmlButton.style.display = "none";
						// Hvis parent div bare inneholder denne knappen, skjul den også
						const parent = htmlButton.parentElement as HTMLElement | null;
						if (
							parent &&
							parent.children.length === 1 &&
							parent.tagName === "DIV"
						) {
							parent.style.display = "none";
						}
					}
				});
			}
		};

		// Kjør etter en liten delay for å la Auth-komponenten rendres først
		const timer = setTimeout(removeProviderButton, 200);
		const timer2 = setTimeout(removeProviderButton, 1000);

		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
	}, []);

	if (!session) {
		if (showSignUp) {
			return (
				<div className="auth-container">
					<SignUpForm
						onSignUpSuccess={() => setShowSignUp(false)}
						onBack={() => setShowSignUp(false)}
					/>
				</div>
			);
		}

		return (
			<div className="auth-container">
				<div style={{ maxWidth: "400px", width: "100%" }}>
					<div className="auth-wrapper">
						<Auth
							supabaseClient={supabase}
							appearance={{
								theme: ThemeSupa,
								variables: {
									default: {
										colors: {
											brand: "#27ae60",
											brandAccent: "#229954",
										},
									},
								},
							}}
							providers={[]}
							view="sign_in"
							onlyThirdPartyProviders={false}
							magicLink={false}
						/>
					</div>
					<div style={{ textAlign: "center", marginTop: "20px" }}>
						<Button
							variant="ghost"
							onClick={() => setShowSignUp(true)}
							className="text-sm underline"
						>
							Har du ikke konto? Registrer deg her
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Layout med sidebar
	return (
		<div className="app-layout">
			<Sidebar
				session={session}
				isAdmin={isAdmin()}
				currentView={currentView}
				onNavigate={setCurrentView}
				onSignOut={() => setSession(null)}
				userProfile={userProfile}
			/>
			<main className="main-content">
				{currentView === "admin" ? (
					<Admin session={session} onBack={() => setCurrentView("dashboard")} />
				) : currentView === "profile" ? (
					<UserAdmin
						session={session}
						onProfileUpdate={() => {
							if (session?.user) {
								fetchUserProfile(session.user.id);
							}
						}}
					/>
				) : (
					<Dashboard
						session={session}
						isAdmin={isAdmin()}
						onShowAdmin={() => setCurrentView("admin")}
						userProfile={userProfile}
					/>
				)}
			</main>
		</div>
	);
}

export default App;
