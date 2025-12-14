import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "./supabaseClient";
import "./Admin.css";

interface ExerciseGroup {
	id: number;
	name: string;
	description?: string;
	order: number;
	active: boolean;
}

interface Exercise {
	id: number;
	title: string;
	description?: string;
	order: number;
	active: boolean;
	exercise_group_id: number;
	sets: number;
	reps?: number | null;
	weight_unit: "kg" | "kropp";
}

interface AdminProps {
	session: Session;
	onBack: () => void;
}

export default function Admin({
	session: _session,
	onBack: _onBack,
}: AdminProps) {
	const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		order: 0,
		active: true,
		exercise_group_id: null as number | null,
		sets: 1,
		reps: null as number | null,
		weight_unit: "kropp" as "kg" | "kropp",
	});
	const [groupFormData, setGroupFormData] = useState({
		name: "",
		description: "",
		order: 0,
		active: true,
	});
	const [showAddForm, setShowAddForm] = useState(false);
	const [showGroupForm, setShowGroupForm] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
	const [exerciseImages, setExerciseImages] = useState<string[]>([]);
	const [uploadingImages, setUploadingImages] = useState(false);
	const [selectedImageService, setSelectedImageService] =
		useState("midjourney");

	useEffect(() => {
		fetchExerciseGroups();
	}, [fetchExerciseGroups]);

	useEffect(() => {
		if (selectedGroupId !== null) {
			fetchExercises();
		}
	}, [selectedGroupId, fetchExercises]);

	async function fetchExerciseGroups() {
		try {
			const { data, error } = await supabase
				.from("exercise_groups")
				.select("*")
				.order("order", { ascending: true });

			if (error) throw error;

			if (data) {
				setExerciseGroups(data);
				if (data.length > 0 && !selectedGroupId) {
					setSelectedGroupId(data[0].id);
				}
			}
			setLoading(false);
		} catch (error: any) {
			console.error("Feil ved henting av exercise groups:", error.message);
			setLoading(false);
		}
	}

	async function fetchExercises() {
		try {
			if (selectedGroupId === null) {
				setExercises([]);
				return;
			}

			const { data, error } = await supabase
				.from("exercises")
				.select("*")
				.eq("exercise_group_id", selectedGroupId)
				.order("order", { ascending: true });

			if (error) throw error;

			if (data) {
				setExercises(data);
			} else {
				setExercises([]);
			}
		} catch (error: any) {
			console.error("Feil ved henting av øvelser:", error.message);
		}
	}

	async function handleSaveGroup() {
		try {
			if (editingGroupId) {
				const { error } = await supabase
					.from("exercise_groups")
					.update({
						name: groupFormData.name,
						description: groupFormData.description,
						order: parseInt(groupFormData.order.toString(), 10),
						active: groupFormData.active,
						updated_at: new Date().toISOString(),
					})
					.eq("id", editingGroupId);

				if (error) throw error;
			} else {
				const { data, error } = await supabase
					.from("exercise_groups")
					.insert([
						{
							name: groupFormData.name,
							description: groupFormData.description,
							order: parseInt(groupFormData.order.toString(), 10),
							active: groupFormData.active,
						},
					])
					.select()
					.single();

				if (error) throw error;

				if (data) {
					await fetchExerciseGroups();
					setSelectedGroupId(data.id);
				} else {
					await fetchExerciseGroups();
				}
			}

			setGroupFormData({
				name: "",
				description: "",
				order: exerciseGroups.length + 1,
				active: true,
			});
			setEditingGroupId(null);
			setShowGroupForm(false);

			if (editingGroupId) {
				await fetchExerciseGroups();
			}
		} catch (error: any) {
			alert(`Feil ved lagring av gruppe: ${error.message}`);
		}
	}

	async function handleSave() {
		try {
			if (!formData.exercise_group_id && selectedGroupId) {
				formData.exercise_group_id = selectedGroupId;
			}

			if (!formData.exercise_group_id) {
				alert("Du må velge en exercise group");
				return;
			}

			let savedExerciseId = editingId;

			if (editingId) {
				const { error } = await supabase
					.from("exercises")
					.update({
						title: formData.title,
						description: formData.description,
						order: parseInt(formData.order.toString(), 10),
						active: formData.active,
						exercise_group_id: formData.exercise_group_id,
						sets: formData.sets ? parseInt(formData.sets.toString(), 10) : 1,
						reps: formData.reps ? parseInt(formData.reps.toString(), 10) : null,
						weight_unit: formData.weight_unit || "kropp",
						updated_at: new Date().toISOString(),
					})
					.eq("id", editingId);

				if (error) throw error;
			} else {
				const { data, error } = await supabase
					.from("exercises")
					.insert([
						{
							title: formData.title,
							description: formData.description,
							order: parseInt(formData.order.toString(), 10),
							active: formData.active,
							exercise_group_id: formData.exercise_group_id || selectedGroupId,
							sets: formData.sets ? parseInt(formData.sets.toString(), 10) : 1,
							reps: formData.reps
								? parseInt(formData.reps.toString(), 10)
								: null,
							weight_unit: formData.weight_unit || "kropp",
						},
					])
					.select()
					.single();

				if (error) throw error;
				if (data) {
					savedExerciseId = data.id;
				}
			}

			if (savedExerciseId && exerciseImages.length > 0) {
				await saveExerciseImages(savedExerciseId);
			}

			setFormData({
				title: "",
				description: "",
				order: exercises.length + 1,
				active: true,
				exercise_group_id: selectedGroupId,
				sets: 1,
				reps: null,
				weight_unit: "kropp",
			});
			setExerciseImages([]);
			setEditingId(null);
			setShowAddForm(false);
			fetchExercises();
		} catch (error: any) {
			alert(`Feil ved lagring: ${error.message}`);
		}
	}

	async function saveExerciseImages(exerciseId: number) {
		try {
			if (editingId) {
				const { data: existingImages } = await supabase
					.from("exercise_images")
					.select("*")
					.eq("exercise_id", exerciseId);

				if (existingImages && existingImages.length > 0) {
					const filesToDelete = existingImages.map((img: any) => {
						const urlParts = img.image_url.split("/");
						return urlParts[urlParts.length - 1].split("?")[0];
					});

					await supabase.storage.from("exercise-images").remove(filesToDelete);

					await supabase
						.from("exercise_images")
						.delete()
						.eq("exercise_id", exerciseId);
				}
			}

			if (exerciseImages.length > 0) {
				const imagesToInsert = exerciseImages.map((imgUrl, index) => ({
					exercise_id: exerciseId,
					image_url: imgUrl,
					order: index,
				}));

				const { error } = await supabase
					.from("exercise_images")
					.insert(imagesToInsert);

				if (error) throw error;
			}
		} catch (error) {
			console.error("Error saving exercise images:", error);
			throw error;
		}
	}

	async function handleEdit(exercise: Exercise) {
		setFormData({
			title: exercise.title,
			description: exercise.description || "",
			order: exercise.order,
			active: exercise.active,
			exercise_group_id: exercise.exercise_group_id || selectedGroupId,
			sets: exercise.sets || 1,
			reps: exercise.reps || null,
			weight_unit: exercise.weight_unit || "kropp",
		});
		setEditingId(exercise.id);
		setShowAddForm(true);

		try {
			const { data: images, error } = await supabase
				.from("exercise_images")
				.select("*")
				.eq("exercise_id", exercise.id)
				.order("order", { ascending: true });

			if (error) throw error;

			if (images && images.length > 0) {
				setExerciseImages(images.map((img: any) => img.image_url));
			} else {
				setExerciseImages([]);
			}
		} catch (error) {
			console.error("Error fetching exercise images:", error);
			setExerciseImages([]);
		}
	}

	function handleEditGroup(group: ExerciseGroup) {
		setGroupFormData({
			name: group.name,
			description: group.description || "",
			order: group.order,
			active: group.active,
		});
		setEditingGroupId(group.id);
		setShowGroupForm(true);
	}

	function handleCancel() {
		setFormData({
			title: "",
			description: "",
			order: exercises.length + 1,
			active: true,
			exercise_group_id: selectedGroupId,
			sets: 1,
			reps: null,
			weight_unit: "kropp",
		});
		setExerciseImages([]);
		setEditingId(null);
		setShowAddForm(false);
		setSelectedImageService("midjourney");
	}

	async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files || []);
		if (files.length === 0) return;

		if (exerciseImages.length + files.length > 5) {
			alert(
				"Maksimum 5 bilder per øvelse. Du har allerede " +
					exerciseImages.length +
					" bilder.",
			);
			return;
		}

		for (const file of files) {
			if (!file.type.startsWith("image/")) {
				alert("Kun bildefiler er tillatt");
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				alert("Bildet er for stort. Maks størrelse er 5MB");
				return;
			}
		}

		setUploadingImages(true);

		try {
			const uploadedUrls: string[] = [];

			for (const file of files) {
				const fileExt = file.name.split(".").pop();
				const timestamp = Date.now();
				const randomId = Math.random().toString(36).substring(7);
				const fileName = `exercise-${timestamp}-${randomId}.${fileExt}`;
				const filePath = fileName;

				const { error: uploadError } = await supabase.storage
					.from("exercise-images")
					.upload(filePath, file, {
						cacheControl: "3600",
						upsert: false,
					});

				if (uploadError) {
					console.error("Upload error:", uploadError);
					throw new Error(`Kunne ikke laste opp bilde: ${uploadError.message}`);
				}

				const {
					data: { publicUrl },
				} = supabase.storage.from("exercise-images").getPublicUrl(filePath);

				if (!publicUrl) {
					throw new Error("Kunne ikke hente URL for opplastet bilde");
				}

				uploadedUrls.push(publicUrl);
			}

			setExerciseImages([...exerciseImages, ...uploadedUrls]);
			event.target.value = "";
		} catch (error: any) {
			console.error("Upload error:", error);
			alert(`Feil ved opplasting av bilder: ${error.message || "Ukjent feil"}`);
		} finally {
			setUploadingImages(false);
		}
	}

	function handleRemoveImage(index: number) {
		const newImages = exerciseImages.filter((_, i) => i !== index);
		setExerciseImages(newImages);
	}

	function generateImageSearchURL(
		exerciseTitle: string,
		exerciseDescription: string,
		service: string,
	) {
		const servicePrompts: Record<string, string> = {
			midjourney:
				"Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Midjourney AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
			dalle:
				"Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. DALL-E AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
			stableDiffusion:
				"Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Stable Diffusion AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
			leonardo:
				"Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Leonardo.ai AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
			generic:
				"Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. AI-generert tegning. Stilistisk illustrasjon. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
		};

		const promptTemplate = servicePrompts[service] || servicePrompts.generic;
		const fullPrompt = promptTemplate
			.replace("[TITTEL]", exerciseTitle || "")
			.replace("[BESKRIVELSE]", exerciseDescription || "");

		const encodedPrompt = encodeURIComponent(fullPrompt);
		const baseURL = "https://www.google.com/search?tbm=isch&q=";
		return baseURL + encodedPrompt;
	}

	function handleGenerateImageSearch() {
		if (!formData.title || !formData.description) {
			alert(
				"Du må fylle ut både tittel og beskrivelse for å generere bildesøk",
			);
			return;
		}

		const url = generateImageSearchURL(
			formData.title,
			formData.description,
			selectedImageService,
		);
		window.open(url, "_blank");
	}

	function handleCancelGroup() {
		setGroupFormData({
			name: "",
			description: "",
			order: exerciseGroups.length + 1,
			active: true,
		});
		setEditingGroupId(null);
		setShowGroupForm(false);
	}

	async function handleDeleteGroup(id: number) {
		if (
			!confirm(
				"Er du sikker på at du vil slette denne exercise group? Alle øvelser i gruppen vil også bli slettet.",
			)
		)
			return;

		try {
			await supabase.from("exercises").delete().eq("exercise_group_id", id);

			const { error } = await supabase
				.from("exercise_groups")
				.delete()
				.eq("id", id);

			if (error) throw error;

			fetchExerciseGroups();
			if (selectedGroupId === id) {
				setSelectedGroupId(null);
			}
		} catch (error: any) {
			alert(`Feil ved sletting: ${error.message}`);
		}
	}

	async function handleDelete(id: number) {
		if (!confirm("Er du sikker på at du vil slette denne øvelsen?")) return;

		try {
			const { error } = await supabase.from("exercises").delete().eq("id", id);

			if (error) throw error;

			fetchExercises();
		} catch (error: any) {
			alert(`Feil ved sletting: ${error.message}`);
		}
	}

	async function handleToggleActive(id: number, currentActive: boolean) {
		try {
			const { error } = await supabase
				.from("exercises")
				.update({ active: !currentActive })
				.eq("id", id);

			if (error) throw error;

			fetchExercises();
		} catch (error: any) {
			alert(`Feil ved oppdatering: ${error.message}`);
		}
	}

	async function handleMoveUp(id: number, currentOrder: number) {
		if (currentOrder <= 1) return;

		const prevExercise = exercises.find((ex) => ex.order === currentOrder - 1);
		if (!prevExercise) return;

		try {
			await supabase
				.from("exercises")
				.update({ order: currentOrder - 1 })
				.eq("id", id);

			await supabase
				.from("exercises")
				.update({ order: currentOrder })
				.eq("id", prevExercise.id);

			fetchExercises();
		} catch (error: any) {
			alert(`Feil ved flytting: ${error.message}`);
		}
	}

	async function handleMoveDown(id: number, currentOrder: number) {
		const maxOrder = Math.max(...exercises.map((ex) => ex.order));
		if (currentOrder >= maxOrder) return;

		const nextExercise = exercises.find((ex) => ex.order === currentOrder + 1);
		if (!nextExercise) return;

		try {
			await supabase
				.from("exercises")
				.update({ order: currentOrder + 1 })
				.eq("id", id);

			await supabase
				.from("exercises")
				.update({ order: currentOrder })
				.eq("id", nextExercise.id);

			fetchExercises();
		} catch (error: any) {
			alert(`Feil ved flytting: ${error.message}`);
		}
	}

	if (loading) {
		return (
			<div style={{ padding: "20px", textAlign: "center" }}>Laster...</div>
		);
	}

	return (
		<div className="admin-container">
			<header className="admin-header">
				<h1>Øvelsesbygger</h1>
				<p style={{ color: "#666", marginTop: "8px", fontSize: "0.95rem" }}>
					Bygg og rediger øvelsene som vises i dagens økt
				</p>
			</header>

			<div className="admin-actions">
				<Button
					onClick={() => {
						setGroupFormData({
							name: "",
							description: "",
							order: exerciseGroups.length + 1,
							active: true,
						});
						setEditingGroupId(null);
						setShowGroupForm(!showGroupForm);
					}}
					variant="outline"
					style={{ marginRight: "10px" }}
				>
					{showGroupForm ? "Avbryt" : "+ Legg til exercise group"}
				</Button>
				<Button
					onClick={() => {
						setFormData({
							title: "",
							description: "",
							order: exercises.length + 1,
							active: true,
							exercise_group_id: selectedGroupId,
							sets: 1,
							reps: null,
							weight_unit: "kropp",
						});
						setExerciseImages([]);
						setEditingId(null);
						setSelectedImageService("midjourney");
						setShowAddForm(!showAddForm);
					}}
					variant="outline"
					disabled={!selectedGroupId && exerciseGroups.length > 0}
				>
					{showAddForm ? "Avbryt" : "+ Legg til ny øvelse"}
				</Button>
			</div>

			{showGroupForm && (
				<Card className="form-card">
					<CardHeader>
						<CardTitle>
							{editingGroupId ? "Rediger exercise group" : "Ny exercise group"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>Gruppens navn:</Label>
							<Input
								type="text"
								value={groupFormData.name}
								onChange={(e) =>
									setGroupFormData({ ...groupFormData, name: e.target.value })
								}
								placeholder="F.eks. Rygg"
							/>
						</div>
						<div className="space-y-2">
							<Label>Beskrivelse:</Label>
							<Textarea
								value={groupFormData.description}
								onChange={(e) =>
									setGroupFormData({
										...groupFormData,
										description: e.target.value,
									})
								}
								placeholder="Beskrivelse av gruppen"
								rows={3}
							/>
						</div>
						<div className="space-y-2">
							<Label>Rekkefølge:</Label>
							<Input
								type="number"
								value={groupFormData.order}
								onChange={(e) =>
									setGroupFormData({
										...groupFormData,
										order: parseInt(e.target.value, 10) || 0,
									})
								}
								min="1"
							/>
						</div>
						<div className="flex items-center space-x-2">
							<Checkbox
								id="group-active"
								checked={groupFormData.active}
								onCheckedChange={(checked: boolean) =>
									setGroupFormData({
										...groupFormData,
										active: checked === true,
									})
								}
							/>
							<Label htmlFor="group-active">Aktiv (vis i Dashboard)</Label>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleSaveGroup}>
								{editingGroupId ? "Oppdater" : "Lagre"}
							</Button>
							<Button variant="outline" onClick={handleCancelGroup}>
								Avbryt
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Exercise Groups liste */}
			{exerciseGroups.length > 0 && (
				<div
					className="exercise-groups-section"
					style={{ marginBottom: "30px" }}
				>
					<h2>Exercise Groups ({exerciseGroups.length})</h2>
					<div
						style={{
							display: "flex",
							gap: "10px",
							marginBottom: "20px",
							flexWrap: "wrap",
						}}
					>
						{exerciseGroups.map((group) => (
							<Button
								key={group.id}
								variant={selectedGroupId === group.id ? "default" : "outline"}
								onClick={() => setSelectedGroupId(group.id)}
							>
								{group.name}
							</Button>
						))}
					</div>
					<div
						style={{
							display: "flex",
							gap: "10px",
							flexWrap: "wrap",
							marginBottom: "20px",
						}}
					>
						{exerciseGroups.map((group) => (
							<Card key={group.id} className="flex-1 min-w-[200px]">
								<CardHeader>
									<div className="flex justify-between items-center">
										<CardTitle className="text-base">{group.name}</CardTitle>
										<span
											className={cn(
												"status-badge",
												group.active ? "active" : "inactive",
											)}
										>
											{group.active ? "Aktiv" : "Inaktiv"}
										</span>
									</div>
									{group.description && (
										<p className="text-sm text-muted-foreground">
											{group.description}
										</p>
									)}
								</CardHeader>
								<CardContent>
									<div className="flex gap-2">
										<Button
											onClick={() => handleEditGroup(group)}
											variant="outline"
											size="sm"
										>
											Rediger
										</Button>
										<Button
											onClick={() => handleDeleteGroup(group.id)}
											variant="destructive"
											size="sm"
										>
											Slett
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{showAddForm && (
				<Card className="form-card">
					<CardHeader>
						<CardTitle>
							{editingId ? "Rediger øvelse" : "Legg til ny øvelse"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>Øvelsens navn:</Label>
							<Input
								type="text"
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
								placeholder="F.eks. Liggende Bekkenvipp"
							/>
						</div>
						<div className="space-y-2">
							<Label>Innhold/Beskrivelse:</Label>
							<Textarea
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								placeholder="F.eks. 10-15 repetisjoner. Stram magen, press ryggen ned."
								rows={4}
							/>
						</div>
						<div className="space-y-2">
							<Label>Exercise Group:</Label>
							<Select
								value={
									formData.exercise_group_id?.toString() ||
									selectedGroupId?.toString() ||
									""
								}
								onValueChange={(value: string) =>
									setFormData({
										...formData,
										exercise_group_id: parseInt(value, 10) || null,
									})
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Velg exercise group" />
								</SelectTrigger>
								<SelectContent>
									{exerciseGroups.map((group) => (
										<SelectItem key={group.id} value={group.id.toString()}>
											{group.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Rekkefølge:</Label>
								<Input
									type="number"
									value={formData.order}
									onChange={(e) =>
										setFormData({
											...formData,
											order: parseInt(e.target.value, 10) || 0,
										})
									}
									min="1"
								/>
							</div>
							<div className="space-y-2">
								<Label>Antall sets:</Label>
								<Input
									type="number"
									value={formData.sets || 1}
									onChange={(e) =>
										setFormData({
											...formData,
											sets: parseInt(e.target.value, 10) || 1,
										})
									}
									min="1"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Antall repetisjoner per set:</Label>
							<Input
								type="number"
								value={formData.reps || ""}
								onChange={(e) =>
									setFormData({
										...formData,
										reps: e.target.value ? parseInt(e.target.value, 10) : null,
									})
								}
								min="1"
								placeholder="F.eks. 10"
							/>
						</div>
						<div className="space-y-2">
							<Label>Vektenhet:</Label>
							<Select
								value={formData.weight_unit || "kropp"}
								onValueChange={(value: string) =>
									setFormData({
										...formData,
										weight_unit: value as "kg" | "kropp",
									})
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="kropp">Kropp</SelectItem>
									<SelectItem value="kg">Kilogram (kg)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center space-x-2">
							<Checkbox
								id="exercise-active"
								checked={formData.active}
								onCheckedChange={(checked) =>
									setFormData({ ...formData, active: checked === true })
								}
							/>
							<Label htmlFor="exercise-active">Aktiv (vis i Dashboard)</Label>
						</div>
						<div className="space-y-2">
							<Label>Bilder (maks 5):</Label>
							<div className="mt-2">
								{exerciseImages.length > 0 && (
									<div className="flex gap-2 flex-wrap mb-2">
										{exerciseImages.map((imgUrl, index) => (
											<div key={index} className="relative inline-block">
												<img
													src={imgUrl}
													alt={`Bilde ${index + 1}`}
													className="w-24 h-24 object-cover rounded-lg border"
												/>
												<Button
													type="button"
													variant="destructive"
													size="sm"
													className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
													onClick={() => handleRemoveImage(index)}
												>
													×
												</Button>
											</div>
										))}
									</div>
								)}
								{exerciseImages.length < 5 && (
									<Label
										className={cn(
											"inline-block px-5 py-2.5 bg-muted border rounded-md cursor-pointer",
											uploadingImages && "opacity-60 cursor-wait",
										)}
									>
										{uploadingImages
											? "Laster opp..."
											: `+ Last opp bilde (${exerciseImages.length}/5)`}
										<Input
											type="file"
											accept="image/*"
											multiple
											onChange={handleImageUpload}
											disabled={uploadingImages}
											className="hidden"
										/>
									</Label>
								)}
							</div>
						</div>
						<div className="space-y-2">
							<Label>Velg AI-bildetjeneste:</Label>
							<Select
								value={selectedImageService}
								onValueChange={setSelectedImageService}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="midjourney">Midjourney</SelectItem>
									<SelectItem value="dalle">DALL-E</SelectItem>
									<SelectItem value="stableDiffusion">
										Stable Diffusion
									</SelectItem>
									<SelectItem value="leonardo">Leonardo.ai</SelectItem>
									<SelectItem value="generic">Generisk AI-tegning</SelectItem>
								</SelectContent>
							</Select>
							<Button
								type="button"
								onClick={handleGenerateImageSearch}
								disabled={!formData.title || !formData.description}
								className="w-full"
							>
								Generer illustrasjon for øvelsen
							</Button>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleSave}>
								{editingId ? "Oppdater" : "Lagre"}
							</Button>
							<Button variant="outline" onClick={handleCancel}>
								Avbryt
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			<div className="exercises-list">
				<h2>
					{selectedGroupId
						? `Øvelser i "${exerciseGroups.find((g) => g.id === selectedGroupId)?.name || "Valgt gruppe"}" (${exercises.length})`
						: `Velg en exercise group for å se øvelser`}
				</h2>
				{!selectedGroupId && exerciseGroups.length > 0 && (
					<p
						style={{ color: "#666", fontSize: "0.9rem", marginBottom: "15px" }}
					>
						Velg en exercise group ovenfor for å se og redigere øvelser
					</p>
				)}
				{exercises.length === 0 && selectedGroupId ? (
					<p style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>
						Ingen øvelser funnet i denne gruppen. Legg til din første øvelse!
					</p>
				) : exercises.length > 0 ? (
					exercises.map((exercise) => (
						<div
							key={exercise.id}
							className={cn("exercise-item", !exercise.active && "inactive")}
						>
							<div className="exercise-info">
								<div className="exercise-header">
									<span className="exercise-order">#{exercise.order}</span>
									<h3>{exercise.title}</h3>
									<span
										className={cn(
											"status-badge",
											exercise.active ? "active" : "inactive",
										)}
									>
										{exercise.active ? "Aktiv" : "Inaktiv"}
									</span>
								</div>
								<p className="exercise-description">{exercise.description}</p>
							</div>
							<div className="exercise-actions">
								<Button
									onClick={() => handleMoveUp(exercise.id, exercise.order)}
									variant="outline"
									size="sm"
									title="Flytt opp"
								>
									↑
								</Button>
								<Button
									onClick={() => handleMoveDown(exercise.id, exercise.order)}
									variant="outline"
									size="sm"
									title="Flytt ned"
								>
									↓
								</Button>
								<Button
									onClick={() =>
										handleToggleActive(exercise.id, exercise.active)
									}
									variant="outline"
									size="sm"
								>
									{exercise.active ? "Deaktiver" : "Aktiver"}
								</Button>
								<Button
									onClick={() => handleEdit(exercise)}
									variant="outline"
									size="sm"
								>
									Rediger
								</Button>
								<Button
									onClick={() => handleDelete(exercise.id)}
									variant="destructive"
									size="sm"
								>
									Slett
								</Button>
							</div>
						</div>
					))
				) : null}
			</div>
		</div>
	);
}
