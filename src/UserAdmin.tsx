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
import { supabase } from "./supabaseClient";
import "./UserAdmin.css";

interface UserAdminProps {
	session: Session;
	onProfileUpdate?: () => void;
}

export default function UserAdmin({
	session,
	onProfileUpdate,
}: UserAdminProps) {
	const [profile, setProfile] = useState({
		firstName: "",
		lastName: "",
		avatarUrl: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		fetchProfile();
	}, [fetchProfile]);

	async function fetchProfile() {
		try {
			const { data, error } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("user_id", session.user.id)
				.single();

			if (error && error.code !== "PGRST116") {
				throw error;
			}

			if (data) {
				const avatarUrl = data.avatar_url || (data as any).avatar_URL || "";

				setProfile({
					firstName: data.first_name || "",
					lastName: data.last_name || "",
					avatarUrl: avatarUrl,
				});
			} else {
				const firstName = session.user.user_metadata?.first_name || "";
				const lastName = session.user.user_metadata?.last_name || "";
				const avatarUrl = session.user.user_metadata?.avatar_url || "";

				setProfile({ firstName, lastName, avatarUrl });
			}
		} catch (error: any) {
			console.error("Feil ved henting av profil:", error.message);
		} finally {
			setLoading(false);
		}
	}

	async function handleSave() {
		setSaving(true);
		setMessage("");

		try {
			const { error } = await supabase.from("user_profiles").upsert(
				{
					user_id: session.user.id,
					first_name: profile.firstName,
					last_name: profile.lastName,
					avatar_url: profile.avatarUrl,
					updated_at: new Date().toISOString(),
				},
				{
					onConflict: "user_id",
				},
			);

			if (error) throw error;

			const { error: metadataError } = await supabase.auth.updateUser({
				data: {
					first_name: profile.firstName,
					last_name: profile.lastName,
					avatar_url: profile.avatarUrl,
				},
			});

			if (metadataError) throw metadataError;

			setMessage("Profil oppdatert!");
			setTimeout(() => setMessage(""), 3000);

			if (onProfileUpdate) {
				onProfileUpdate();
			}
		} catch (error: any) {
			setMessage(`Feil ved lagring: ${error.message}`);
		} finally {
			setSaving(false);
		}
	}

	async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			setMessage("Kun bildefiler er tillatt");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setMessage("Bildet er for stort. Maks størrelse er 5MB");
			return;
		}

		setUploading(true);
		setMessage("");

		try {
			const fileExt = file.name.split(".").pop();
			const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
			const filePath = fileName;

			if (profile.avatarUrl) {
				try {
					const urlParts = profile.avatarUrl.split("/");
					let oldFileName = urlParts[urlParts.length - 1];
					oldFileName = oldFileName.split("?")[0];

					if (oldFileName?.includes(".")) {
						const { error: removeError } = await supabase.storage
							.from("avatars")
							.remove([oldFileName]);

						if (removeError) {
							console.log(
								"Første slettingsforsøk feilet, prøver alternativ path:",
								removeError.message,
							);
							try {
								const { error: altError } = await supabase.storage
									.from("avatars")
									.remove([`avatars/${oldFileName}`]);
								if (altError) {
									console.log(
										"Alternativ sletting feilet også:",
										altError.message,
									);
								}
							} catch (altError) {
								console.log("Alternativ sletting feilet også:", altError);
							}
						}
					}
				} catch (error) {
					console.log(
						"Feil ved sletting av gammelt bilde (ikke kritisk):",
						error,
					);
				}
			}

			console.log("Laster opp bilde med path:", filePath);
			const { error: uploadError } = await supabase.storage
				.from("avatars")
				.upload(filePath, file, {
					cacheControl: "3600",
					upsert: false,
				});

			if (uploadError) {
				console.error("Upload error detaljer:", {
					message: uploadError.message,
					name: uploadError.name,
				});
				throw new Error(`Kunne ikke laste opp bilde: ${uploadError.message}`);
			}

			console.log("Bilde lastet opp, henter public URL...");
			const {
				data: { publicUrl },
			} = supabase.storage.from("avatars").getPublicUrl(filePath);

			console.log("Public URL hentet:", publicUrl);

			if (!publicUrl) {
				throw new Error("Kunne ikke hente URL for opplastet bilde");
			}

			const newProfile = { ...profile, avatarUrl: publicUrl };
			setProfile(newProfile);

			console.log("Lagrer URL i database:", publicUrl);
			const { error: dbError } = await supabase.from("user_profiles").upsert(
				{
					user_id: session.user.id,
					first_name: profile.firstName,
					last_name: profile.lastName,
					avatar_url: publicUrl,
					updated_at: new Date().toISOString(),
				},
				{
					onConflict: "user_id",
				},
			);

			if (dbError) {
				console.error("Database error detaljer:", {
					message: dbError.message,
					code: dbError.code,
					details: dbError.details,
					hint: dbError.hint,
				});
				try {
					const { error: altDbError } = await supabase
						.from("user_profiles")
						.upsert(
							{
								user_id: session.user.id,
								first_name: profile.firstName,
								last_name: profile.lastName,
								avatar_URL: publicUrl,
								updated_at: new Date().toISOString(),
							},
							{
								onConflict: "user_id",
							},
						);

					if (altDbError) {
						throw altDbError;
					} else {
						console.log("Lagret med avatar_URL (store bokstaver)");
						setMessage("Bilde lastet opp og lagret!");
					}
				} catch (altError) {
					console.error("Alternativ database lagring feilet også:", altError);
					setMessage(
						"Bilde lastet opp, men kunne ikke lagre i database. Prøv å lagre manuelt.",
					);
				}
			} else {
				console.log("URL lagret i database med avatar_url");
				const { error: metadataError } = await supabase.auth.updateUser({
					data: {
						first_name: profile.firstName,
						last_name: profile.lastName,
						avatar_url: publicUrl,
					},
				});

				if (metadataError) {
					console.error("Metadata update error:", metadataError);
				}

				setMessage("Bilde lastet opp og lagret!");

				if (onProfileUpdate) {
					onProfileUpdate();
				}
			}
		} catch (error: any) {
			console.error("Upload error details:", error);
			setMessage(
				`Feil ved opplasting av bilde: ${error.message || "Ukjent feil"}`,
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleRemoveImage() {
		if (!profile.avatarUrl) return;

		setUploading(true);
		setMessage("");

		try {
			const urlParts = profile.avatarUrl.split("/");
			const fileName = urlParts[urlParts.length - 1];
			const cleanFileName = fileName.split("?")[0];

			if (cleanFileName?.includes(".")) {
				const { error: removeError } = await supabase.storage
					.from("avatars")
					.remove([cleanFileName]);

				if (removeError) {
					console.error("Remove error:", removeError);
					try {
						await supabase.storage
							.from("avatars")
							.remove([`avatars/${cleanFileName}`]);
					} catch (altError) {
						console.error("Alternativ sletting feilet:", altError);
					}
				}
			}

			const newProfile = { ...profile, avatarUrl: "" };
			setProfile(newProfile);

			const { error: dbError } = await supabase.from("user_profiles").upsert(
				{
					user_id: session.user.id,
					first_name: profile.firstName,
					last_name: profile.lastName,
					avatar_url: "",
					updated_at: new Date().toISOString(),
				},
				{
					onConflict: "user_id",
				},
			);

			if (!dbError) {
				const { error: metadataError } = await supabase.auth.updateUser({
					data: {
						first_name: profile.firstName,
						last_name: profile.lastName,
						avatar_url: "",
					},
				});

				if (metadataError) {
					console.error("Metadata update error:", metadataError);
				}

				setMessage("Bilde fjernet!");

				if (onProfileUpdate) {
					onProfileUpdate();
				}
			} else {
				setMessage("Bilde fjernet fra visning. Husk å lagre endringene.");
			}
		} catch (error) {
			console.error("Feil ved sletting av bilde:", error);
			setProfile({ ...profile, avatarUrl: "" });
			setMessage("Bilde fjernet fra visning. Husk å lagre endringene.");
		} finally {
			setUploading(false);
		}
	}

	const getUserInitial = (): string => {
		return (
			profile.firstName?.[0] ||
			profile.lastName?.[0] ||
			session?.user?.email?.[0]?.toUpperCase() ||
			"?"
		);
	};

	if (loading) {
		return (
			<div style={{ padding: "20px", textAlign: "center" }}>
				Laster profil...
			</div>
		);
	}

	return (
		<div className="user-admin-container">
			<header className="user-admin-header">
				<h1>Min profil</h1>
				<p style={{ color: "#666", marginTop: "8px", fontSize: "0.95rem" }}>
					Rediger din profilinformasjon og profilbilde
				</p>
			</header>

			{message && (
				<Alert
					variant={message.includes("Feil") ? "destructive" : "default"}
					className="mb-4"
				>
					<AlertDescription>{message}</AlertDescription>
				</Alert>
			)}

			<Card className="profile-form">
				<CardHeader>
					<CardTitle>Profilinformasjon</CardTitle>
					<CardDescription>Oppdater din profil</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="profile-image-section">
						<h3>Profilbilde</h3>
						<div className="avatar-container">
							{profile.avatarUrl ? (
								<img
									src={profile.avatarUrl}
									alt="Profilbilde"
									className="avatar-preview"
								/>
							) : (
								<div className="avatar-placeholder">{getUserInitial()}</div>
							)}
						</div>
						<div className="image-actions flex gap-2">
							<Label className="upload-btn cursor-pointer">
								{uploading ? "Laster opp..." : "Last opp bilde"}
								<Input
									type="file"
									accept="image/*"
									onChange={handleImageUpload}
									disabled={uploading}
									className="hidden"
								/>
							</Label>
							{profile.avatarUrl && (
								<Button onClick={handleRemoveImage} variant="outline">
									Fjern bilde
								</Button>
							)}
						</div>
					</div>

					<div className="profile-info-section space-y-4">
						<div className="space-y-2">
							<Label htmlFor="firstName">Fornavn:</Label>
							<Input
								id="firstName"
								type="text"
								value={profile.firstName}
								onChange={(e) =>
									setProfile({ ...profile, firstName: e.target.value })
								}
								placeholder="Skriv inn fornavn"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="lastName">Etternavn:</Label>
							<Input
								id="lastName"
								type="text"
								value={profile.lastName}
								onChange={(e) =>
									setProfile({ ...profile, lastName: e.target.value })
								}
								placeholder="Skriv inn etternavn"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">E-post:</Label>
							<Input
								id="email"
								type="email"
								value={session.user.email || ""}
								disabled
								className="disabled-input"
							/>
							<small className="text-muted-foreground text-sm">
								E-post kan ikke endres
							</small>
						</div>

						<div className="form-actions">
							<Button onClick={handleSave} disabled={saving} className="w-full">
								{saving ? "Lagrer..." : "Lagre endringer"}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
