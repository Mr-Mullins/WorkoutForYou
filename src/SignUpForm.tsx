import { useState } from "react";
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
import "./SignUpForm.css";

interface SignUpFormProps {
	onSignUpSuccess?: () => void;
	onBack?: () => void;
}

export default function SignUpForm({
	onSignUpSuccess,
	onBack,
}: SignUpFormProps) {
	const [formData, setFormData] = useState({
		email: "",
		password: "",
		confirmPassword: "",
		firstName: "",
		lastName: "",
	});
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		// Validering
		if (formData.password !== formData.confirmPassword) {
			setMessage("Passordene matcher ikke");
			return;
		}

		if (formData.password.length < 6) {
			setMessage("Passordet må være minst 6 tegn");
			return;
		}

		if (!formData.firstName.trim() || !formData.lastName.trim()) {
			setMessage("Fornavn og etternavn er påkrevd");
			return;
		}

		setLoading(true);

		try {
			// Opprett bruker
			const { error } = await supabase.auth.signUp({
				email: formData.email,
				password: formData.password,
				options: {
					data: {
						first_name: formData.firstName.trim(),
						last_name: formData.lastName.trim(),
					},
				},
			});

			if (error) throw error;

			// Profil vil bli opprettet automatisk via database trigger
			// eller når brukeren logger inn første gang

			setMessage(
				"Registrering vellykket! Sjekk e-posten din for bekreftelseslenke.",
			);

			// Vent litt før redirect
			setTimeout(() => {
				if (onSignUpSuccess) onSignUpSuccess();
			}, 2000);
		} catch (error: any) {
			setMessage(`Feil ved registrering: ${error.message}`);
			setLoading(false);
		}
	};

	return (
		<div className="signup-container">
			<Card className="w-full max-w-md mx-auto">
				<CardHeader>
					<CardTitle>Opprett konto</CardTitle>
					<CardDescription>
						Fyll ut informasjonen nedenfor for å opprette en konto
					</CardDescription>
				</CardHeader>
				<CardContent>
					{message && (
						<Alert
							variant={message.includes("Feil") ? "destructive" : "default"}
							className="mb-4"
						>
							<AlertDescription>{message}</AlertDescription>
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="firstName">Fornavn *</Label>
								<Input
									id="firstName"
									type="text"
									value={formData.firstName}
									onChange={(e) =>
										setFormData({ ...formData, firstName: e.target.value })
									}
									required
									placeholder="Skriv inn fornavn"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="lastName">Etternavn *</Label>
								<Input
									id="lastName"
									type="text"
									value={formData.lastName}
									onChange={(e) =>
										setFormData({ ...formData, lastName: e.target.value })
									}
									required
									placeholder="Skriv inn etternavn"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">E-post *</Label>
							<Input
								id="email"
								type="email"
								value={formData.email}
								onChange={(e) =>
									setFormData({ ...formData, email: e.target.value })
								}
								required
								placeholder="din@epost.no"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">Passord *</Label>
							<Input
								id="password"
								type="password"
								value={formData.password}
								onChange={(e) =>
									setFormData({ ...formData, password: e.target.value })
								}
								required
								minLength={6}
								placeholder="Minst 6 tegn"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Bekreft passord *</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={formData.confirmPassword}
								onChange={(e) =>
									setFormData({ ...formData, confirmPassword: e.target.value })
								}
								required
								minLength={6}
								placeholder="Bekreft passordet"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Button type="submit" disabled={loading} className="w-full">
								{loading ? "Oppretter konto..." : "Opprett konto"}
							</Button>
							{onBack && (
								<Button
									type="button"
									variant="outline"
									onClick={onBack}
									className="w-full"
								>
									Tilbake til innlogging
								</Button>
							)}
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
