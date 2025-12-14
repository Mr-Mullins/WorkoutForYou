import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "./supabaseClient";
import "./Dashboard.css";

interface UserProfile {
	first_name?: string;
	last_name?: string;
	avatar_url?: string;
}

interface ExerciseImage {
	image_url: string;
	order: number;
}

interface Exercise {
	id: number;
	title: string;
	description?: string;
	desc?: string;
	active: boolean;
	order: number;
	sets: number;
	weight_unit: "kg" | "kropp";
	exercise_images?: ExerciseImage[];
}

interface ExerciseGroup {
	id: number;
	name: string;
	description?: string;
	order: number;
	active: boolean;
	exercises?: Exercise[];
}

interface WorkoutSet {
	set_number: number;
	weight: number;
	workout_id?: number;
}

interface WorkoutModal {
	exercise: Exercise;
	lastWorkoutWeights: WorkoutSet[];
}

interface DashboardProps {
	session: Session;
	isAdmin?: boolean;
	onShowAdmin?: () => void;
	userProfile: UserProfile | null;
}

export default function Dashboard({
	session,
	isAdmin: _isAdmin = false,
	onShowAdmin: _onShowAdmin,
	userProfile: _userProfile,
}: DashboardProps) {
	const [completed, setCompleted] = useState<number[]>([]);
	const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
	const [selectedImage, setSelectedImage] = useState<string | null>(null);
	const [workoutModal, setWorkoutModal] = useState<WorkoutModal | null>(null);
	const [workoutWeights, setWorkoutWeights] = useState<Record<number, string>>(
		{},
	);
	const [exerciseLastWeights, setExerciseLastWeights] = useState<
		Record<number, WorkoutSet[]>
	>({});

	useEffect(() => {
		let isMounted = true;

		const loadData = async () => {
			setLoading(true);
			try {
				await Promise.all([fetchExerciseGroups(), fetchTodaysWorkouts()]);
			} catch (error: any) {
				console.error("Feil ved lasting av data:", error.message);
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		loadData();

		return () => {
			isMounted = false;
		};
	}, [fetchExerciseGroups, fetchTodaysWorkouts]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selectedImage) {
				setSelectedImage(null);
			}
		};

		if (selectedImage) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "unset";
		};
	}, [selectedImage]);

	// Hent vektdata når exerciseGroups er lastet
	useEffect(() => {
		if (exerciseGroups.length > 0 && !loading && session?.user) {
			fetchAllLastWeights();
		}
	}, [exerciseGroups.length, loading, fetchAllLastWeights, session?.user]);

	async function fetchExerciseGroups() {
		try {
			// Optimalisert: Hent alle grupper med øvelser og bilder i ett enkelt kall ved hjelp av JOIN
			const { data: groups, error: groupsError } = await supabase
				.from("exercise_groups")
				.select(`
          *,
          exercises:exercises!exercise_group_id(
            *,
            active,
            exercise_images(
              image_url,
              order
            )
          )
        `)
				.eq("active", true)
				.order("order", { ascending: true });

			if (groupsError) throw groupsError;

			if (groups && groups.length > 0) {
				// Filtrer og sorter øvelser for hver gruppe, og sorter bilder
				const groupsWithExercises = groups.map((group) => ({
					...group,
					exercises: (group.exercises || [])
						.filter((ex: Exercise) => ex.active)
						.sort((a: Exercise, b: Exercise) => (a.order || 0) - (b.order || 0))
						.map((ex: Exercise) => ({
							...ex,
							exercise_images: (ex.exercise_images || []).sort(
								(a: ExerciseImage, b: ExerciseImage) =>
									(a.order || 0) - (b.order || 0),
							),
						})),
				}));

				setExerciseGroups(groupsWithExercises);
				if (selectedGroupId === null && groupsWithExercises.length > 0) {
					setSelectedGroupId(groupsWithExercises[0].id);
				}
			} else {
				// Fallback: Hent alle aktive øvelser hvis ingen grupper finnes
				const { data: exercises, error } = await supabase
					.from("exercises")
					.select(`
            *,
            exercise_images(
              image_url,
              order
            )
          `)
					.eq("active", true)
					.order("order", { ascending: true });

				if (error) throw error;

				if (exercises && exercises.length > 0) {
					const fallbackGroup: ExerciseGroup = {
						id: 0,
						name: "Alle øvelser",
						description: "",
						order: 0,
						active: true,
						exercises: exercises.map((ex: Exercise) => ({
							...ex,
							exercise_images: (ex.exercise_images || []).sort(
								(a: ExerciseImage, b: ExerciseImage) =>
									(a.order || 0) - (b.order || 0),
							),
						})),
					};
					setExerciseGroups([fallbackGroup]);
					if (selectedGroupId === null) {
						setSelectedGroupId(0);
					}
				}
			}
		} catch (error: any) {
			console.error("Feil ved henting av øvelser:", error.message);
			// Fallback til tom liste hvis tabellen ikke finnes ennå
			setExerciseGroups([]);
		}
	}

	async function fetchTodaysWorkouts() {
		try {
			const user = session.user;
			const today = new Date().toISOString().split("T")[0];

			const { data, error } = await supabase
				.from("workouts")
				.select("exercise_id")
				.eq("user_id", user.id)
				.eq("completed_at", today);

			if (error) throw error;

			if (data) {
				setCompleted(data.map((row) => row.exercise_id));
			}
		} catch (error: any) {
			console.error("Feil ved henting av øvelser:", error.message);
		}
	}

	async function toggleExercise(exercise: Exercise) {
		const isDone = completed.includes(exercise.id);

		if (isDone) {
			alert("Allerede registrert i dag! Bra jobba.");
			return;
		}

		// Hent vekt fra forrige gang hvis øvelsen bruker kg
		let lastWorkoutWeights: WorkoutSet[] = [];
		if (exercise.weight_unit === "kg") {
			lastWorkoutWeights = await fetchLastWorkoutWeights(exercise.id);
		}

		// Åpne modal
		setWorkoutModal({ exercise, lastWorkoutWeights });

		// Initialiser vekt-array med tomme verdier eller verdier fra forrige gang
		const initialWeights: Record<number, string> = {};
		const numSets = exercise.sets || 1;
		for (let i = 1; i <= numSets; i++) {
			initialWeights[i] = lastWorkoutWeights[i - 1]?.weight?.toString() || "";
		}
		setWorkoutWeights(initialWeights);
	}

	async function fetchLastWorkoutWeights(
		exerciseId: number,
	): Promise<WorkoutSet[]> {
		try {
			const user = session.user;
			const today = new Date().toISOString().split("T")[0];

			// Hent siste workout for denne øvelsen (ikke i dag)
			const { data: lastWorkout, error: workoutError } = await supabase
				.from("workouts")
				.select("id")
				.eq("user_id", user.id)
				.eq("exercise_id", exerciseId)
				.neq("completed_at", today)
				.order("completed_at", { ascending: false })
				.limit(1)
				.maybeSingle();

			if (workoutError || !lastWorkout) {
				return [];
			}

			// Hent workout_sets for denne workout
			const { data: sets, error: setsError } = await supabase
				.from("workout_sets")
				.select("*")
				.eq("workout_id", lastWorkout.id)
				.order("set_number", { ascending: true });

			if (setsError) {
				console.error("Error fetching workout sets:", setsError);
				return [];
			}

			return sets || [];
		} catch (error) {
			console.error("Error fetching last workout weights:", error);
			return [];
		}
	}

	async function fetchAllLastWeights() {
		try {
			const user = session.user;
			const today = new Date().toISOString().split("T")[0];

			// Hent alle kg-øvelser fra exerciseGroups state
			const kgExercises: number[] = [];
			exerciseGroups.forEach((group) => {
				if (group.exercises) {
					group.exercises.forEach((ex) => {
						if (ex.weight_unit === "kg" && ex.active) {
							kgExercises.push(ex.id);
						}
					});
				}
			});

			if (kgExercises.length === 0) {
				return;
			}

			// Hent siste workout for hver kg-øvelse (ikke i dag)
			const { data: lastWorkouts, error: workoutError } = await supabase
				.from("workouts")
				.select("id, exercise_id, completed_at")
				.eq("user_id", user.id)
				.in("exercise_id", kgExercises)
				.neq("completed_at", today)
				.order("completed_at", { ascending: false });

			if (workoutError || !lastWorkouts || lastWorkouts.length === 0) {
				return;
			}

			// Grupper workouts per exercise_id (ta bare den siste for hver øvelse)
			const latestWorkoutPerExercise: Record<number, number> = {};
			lastWorkouts.forEach((workout) => {
				if (!latestWorkoutPerExercise[workout.exercise_id]) {
					latestWorkoutPerExercise[workout.exercise_id] = workout.id;
				}
			});

			// Hent alle workout_sets for disse workouts
			const workoutIds = Object.values(latestWorkoutPerExercise);
			if (workoutIds.length === 0) {
				return;
			}

			const { data: allSets, error: setsError } = await supabase
				.from("workout_sets")
				.select("set_number, weight, workout_id")
				.in("workout_id", workoutIds)
				.order("set_number", { ascending: true });

			if (setsError) {
				console.error("Error fetching workout sets:", setsError);
				return;
			}

			// Organiser sets per exercise_id
			const weightsByExercise: Record<number, WorkoutSet[]> = {};
			if (allSets) {
				// Må mappe workout_id tilbake til exercise_id
				const workoutToExercise: Record<number, number> = {};
				Object.entries(latestWorkoutPerExercise).forEach(
					([exerciseId, workoutId]) => {
						workoutToExercise[workoutId] = parseInt(exerciseId, 10);
					},
				);

				allSets.forEach((set) => {
					const exerciseId = workoutToExercise[set.workout_id];
					if (exerciseId) {
						if (!weightsByExercise[exerciseId]) {
							weightsByExercise[exerciseId] = [];
						}
						weightsByExercise[exerciseId].push({
							set_number: set.set_number,
							weight: set.weight,
						});
					}
				});
			}

			setExerciseLastWeights(weightsByExercise);
		} catch (error) {
			console.error("Error fetching all last weights:", error);
		}
	}

	async function saveWorkoutWithSets(
		exerciseId: number,
		setsData: Record<number, string>,
	) {
		try {
			const user = session.user;
			const today = new Date().toISOString().split("T")[0];

			// Opprett workout
			const { data: workout, error: workoutError } = await supabase
				.from("workouts")
				.insert([
					{
						user_id: user.id,
						exercise_id: exerciseId,
						completed_at: today,
					},
				])
				.select()
				.single();

			if (workoutError) throw workoutError;

			// Hvis øvelsen bruker kg og det er vektdata, lagre workout_sets
			if (setsData && Object.keys(setsData).length > 0) {
				const setsToInsert = Object.entries(setsData)
					.filter(([_setNum, weight]) => weight !== "" && weight !== null)
					.map(([setNum, weight]) => ({
						workout_id: workout.id,
						set_number: parseInt(setNum, 10),
						weight: parseFloat(weight),
					}));

				if (setsToInsert.length > 0) {
					const { error: setsError } = await supabase
						.from("workout_sets")
						.insert(setsToInsert);

					if (setsError) throw setsError;
				}
			}

			setCompleted([...completed, exerciseId]);
			setWorkoutModal(null);
			setWorkoutWeights({});

			// Oppdater vektdata for denne øvelsen i state
			if (setsData && Object.keys(setsData).length > 0) {
				const newWeights = Object.entries(setsData)
					.filter(([_setNum, weight]) => weight !== "" && weight !== null)
					.map(([setNum, weight]) => ({
						set_number: parseInt(setNum, 10),
						weight: parseFloat(weight),
					}));

				setExerciseLastWeights((prev) => ({
					...prev,
					[exerciseId]: newWeights,
				}));
			}
		} catch (error: any) {
			alert(`Klarte ikke lagre: ${error.message}`);
		}
	}

	function handleCloseWorkoutModal() {
		setWorkoutModal(null);
		setWorkoutWeights({});
	}

	function handleCopyLastWeights() {
		if (
			!workoutModal?.lastWorkoutWeights ||
			workoutModal.lastWorkoutWeights.length === 0
		) {
			return;
		}

		const newWeights: Record<number, string> = {};
		workoutModal.lastWorkoutWeights.forEach((set, index) => {
			newWeights[index + 1] = set.weight?.toString() || "";
		});
		setWorkoutWeights(newWeights);
	}

	if (loading) {
		return (
			<div className="dashboard-loading">
				<p>Laster dine data...</p>
			</div>
		);
	}

	const selectedGroup = exerciseGroups.find((g) => g.id === selectedGroupId);
	const groupExercises = selectedGroup?.exercises || [];

	// Tab colors
	const tabColors = [
		"#3498db",
		"#e74c3c",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#e67e22",
		"#34495e",
		"#16a085",
	];

	return (
		<div className="dashboard-container">
			{selectedGroup && (
				<div className="dashboard-content">
					{/* Tabs */}
					{exerciseGroups.length > 1 && (
						<div className="tabs-container">
							{exerciseGroups.map((group, index) => {
								const groupExercises = group.exercises || [];
								const completedInGroup = groupExercises.filter((ex) =>
									completed.includes(ex.id),
								).length;
								const allCompleted =
									groupExercises.length > 0 &&
									completedInGroup === groupExercises.length;
								const tabColor = tabColors[index % tabColors.length];
								const isActive = selectedGroupId === group.id;

								return (
									<Button
										key={group.id}
										variant="outline"
										className={cn(
											"tab-button",
											isActive && "active",
											allCompleted && "completed",
										)}
										onClick={() => setSelectedGroupId(group.id)}
										style={
											{
												"--tab-color": tabColor,
												...(isActive
													? {
															borderTopColor: tabColor,
															borderRightColor: tabColor,
															borderLeftColor: tabColor,
															borderBottomColor: tabColor,
															color: tabColor,
														}
													: {
															borderTopColor: `${tabColor}80`,
															borderRightColor: `${tabColor}80`,
															borderLeftColor: `${tabColor}80`,
															borderBottomColor: "transparent",
															color: tabColor,
														}),
												...(allCompleted
													? {
															borderTopColor: "#27ae60",
															borderRightColor: "#27ae60",
															borderLeftColor: "#27ae60",
															borderBottomColor: "#27ae60",
															color: "#27ae60",
														}
													: {}),
											} as React.CSSProperties
										}
									>
										<span className="tab-name">
											{group.name}{" "}
											<span className="tab-counter">
												{completedInGroup}/{groupExercises.length}
											</span>
										</span>
									</Button>
								);
							})}
						</div>
					)}

					{/* Exercises */}
					<div className="exercises-wrapper">
						{groupExercises.length > 0 ? (
							groupExercises.map((ex) => {
								const isDone = completed.includes(ex.id);
								const images =
									ex.exercise_images && ex.exercise_images.length > 0
										? ex.exercise_images.map((img) => img.image_url)
										: [];
								const lastWeights = exerciseLastWeights[ex.id] || [];
								return (
									<div
										key={ex.id}
										className={cn("exercise-card", isDone && "completed")}
									>
										<div className="exercise-card-content">
											{images.length > 0 && (
												<div className="exercise-images-container">
													{images.map((imageUrl, index) => (
														<div
															key={index}
															className="exercise-image-thumbnail"
															onClick={() => setSelectedImage(imageUrl)}
														>
															<img
																src={imageUrl}
																alt={`${ex.title} - Bilde ${index + 1}`}
																className="exercise-thumbnail-img"
															/>
														</div>
													))}
												</div>
											)}
											<div className="exercise-card-main">
												<div className="exercise-card-header">
													<h3 className="exercise-title">{ex.title}</h3>
													<Button
														className={cn(
															"exercise-button",
															isDone && "completed",
														)}
														onClick={() => toggleExercise(ex)}
														disabled={isDone}
													>
														{isDone && (
															<span className="exercise-checkmark-icon">✓</span>
														)}
														{isDone ? "Utført!" : "Marker som utført"}
													</Button>
												</div>
												<p className="exercise-description">
													{ex.description || ex.desc}
												</p>
												{ex.weight_unit === "kg" && lastWeights.length > 0 && (
													<div className="exercise-last-weights">
														<span className="last-weights-label">
															Forrige gang:
														</span>
														<span className="last-weights-values">
															{lastWeights.map((set, index) => (
																<span key={index} className="last-weight-item">
																	Set {set.set_number}: {set.weight} kg
																	{index < lastWeights.length - 1 && ", "}
																</span>
															))}
														</span>
													</div>
												)}
											</div>
										</div>
									</div>
								);
							})
						) : (
							<p className="no-exercises">Ingen øvelser i denne gruppen</p>
						)}
					</div>

					{/* Image Modal/Lightbox */}
					{selectedImage && (
						<div
							className="image-modal-overlay"
							onClick={() => setSelectedImage(null)}
						>
							<div
								className="image-modal-content"
								onClick={(e) => e.stopPropagation()}
							>
								<Button
									variant="ghost"
									className="image-modal-close"
									onClick={() => setSelectedImage(null)}
									aria-label="Lukk bilde"
								>
									×
								</Button>
								<img
									src={selectedImage}
									alt="Stort bilde"
									className="image-modal-img"
								/>
							</div>
						</div>
					)}

					{/* Workout Modal */}
					{workoutModal && (
						<Dialog
							open={!!workoutModal}
							onOpenChange={() => handleCloseWorkoutModal()}
						>
							<DialogContent className="max-w-md">
								<DialogHeader>
									<DialogTitle>
										Registrer {workoutModal.exercise.title}
									</DialogTitle>
								</DialogHeader>

								{workoutModal.exercise.weight_unit === "kg" && (
									<>
										<div className="workout-modal-section">
											<h3>Vekt per set</h3>
											{Array.from(
												{ length: workoutModal.exercise.sets || 1 },
												(_, i) => i + 1,
											).map((setNum) => (
												<div
													key={setNum}
													className="workout-weight-input-group space-y-2"
												>
													<Label>Set {setNum} (kg):</Label>
													<Input
														type="number"
														step="0.5"
														value={workoutWeights[setNum] || ""}
														onChange={(e) =>
															setWorkoutWeights({
																...workoutWeights,
																[setNum]: e.target.value,
															})
														}
														placeholder="0"
													/>
												</div>
											))}
										</div>

										{workoutModal.lastWorkoutWeights &&
											workoutModal.lastWorkoutWeights.length > 0 && (
												<div className="workout-modal-section">
													<h3>Forrige gang</h3>
													<div className="last-workout-weights">
														{workoutModal.lastWorkoutWeights.map(
															(set, index) => (
																<div key={index} className="last-weight-item">
																	Set {set.set_number}: {set.weight} kg
																</div>
															),
														)}
													</div>
													<Button
														variant="outline"
														className="copy-weights-btn w-full mt-2"
														onClick={handleCopyLastWeights}
													>
														Bruk vekt fra forrige gang
													</Button>
												</div>
											)}
									</>
								)}

								{workoutModal.exercise.weight_unit === "kropp" && (
									<DialogDescription>
										Ingen vektregistrering for denne øvelsen.
									</DialogDescription>
								)}

								<div className="workout-modal-actions flex gap-2">
									<Button
										className="workout-save-btn flex-1"
										onClick={() =>
											saveWorkoutWithSets(
												workoutModal.exercise.id,
												workoutWeights,
											)
										}
									>
										Lagre
									</Button>
									<Button
										variant="outline"
										className="workout-cancel-btn flex-1"
										onClick={handleCloseWorkoutModal}
									>
										Avbryt
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					)}
				</div>
			)}
		</div>
	);
}
