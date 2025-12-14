import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "./supabaseClient";
import "./Sidebar.css";

interface UserProfile {
	first_name?: string;
	last_name?: string;
	avatar_url?: string;
}

interface SidebarProps {
	session: Session;
	isAdmin: boolean;
	currentView: "dashboard" | "admin" | "profile";
	onNavigate: (view: "dashboard" | "admin" | "profile") => void;
	onSignOut: () => void;
	userProfile: UserProfile | null;
}

export default function Sidebar({
	session,
	isAdmin: _isAdmin,
	currentView,
	onNavigate,
	onSignOut,
	userProfile,
}: SidebarProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		if (onSignOut) onSignOut();
	};

	const handleNavigate = (view: "dashboard" | "admin" | "profile") => {
		onNavigate(view);
		setIsOpen(false); // Lukk menyen på mobil etter navigering
	};

	const getUserDisplayName = (): string => {
		if (userProfile?.first_name && userProfile?.last_name) {
			return `${userProfile.first_name} ${userProfile.last_name}`;
		}
		if (userProfile?.first_name || userProfile?.last_name) {
			return `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
		}
		return session?.user?.email?.split("@")[0] || "User";
	};

	const getUserInitial = (): string => {
		return (
			userProfile?.first_name?.[0] ||
			userProfile?.last_name?.[0] ||
			session?.user?.email?.[0]?.toUpperCase() ||
			"?"
		);
	};

	return (
		<>
			{/* Sticky Header */}
			<header className="app-header">
				<button
					className="sidebar-toggle"
					onClick={() => setIsOpen(!isOpen)}
					aria-label="Toggle menu"
				>
					<span className={cn("hamburger", isOpen && "open")}>
						<span></span>
						<span></span>
						<span></span>
					</span>
				</button>
				<h1 className="header-title">WorkOutForYou</h1>
				<div className="header-spacer"></div>
			</header>

			{/* Overlay for mobil */}
			{isOpen && (
				<div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
			)}

			{/* Sidebar */}
			<aside className={cn("sidebar", isOpen && "open")}>
				<div className="sidebar-header">
					<h2>WorkoutForYou</h2>
					<div className="user-profile">
						{userProfile?.avatar_url ? (
							<img
								src={userProfile.avatar_url}
								alt="Profilbilde"
								className="profile-avatar"
							/>
						) : (
							<div className="profile-avatar-placeholder">
								{getUserInitial()}
							</div>
						)}
						<div className="user-info">
							<p className="user-name">{getUserDisplayName()}</p>
							<p className="user-email">{session?.user?.email}</p>
						</div>
					</div>
				</div>

				<nav className="sidebar-nav">
					<Button
						variant="ghost"
						className={cn(
							"nav-item w-full justify-start",
							currentView === "dashboard" && "active",
						)}
						onClick={() => handleNavigate("dashboard")}
					>
						<span className="nav-icon">🏋️</span>
						<span className="nav-text">Dagens økt</span>
					</Button>

					<Button
						variant="ghost"
						className={cn(
							"nav-item w-full justify-start",
							currentView === "admin" && "active",
						)}
						onClick={() => handleNavigate("admin")}
					>
						<span className="nav-icon">🔧</span>
						<span className="nav-text">Øvelsesbygger</span>
					</Button>

					<Button
						variant="ghost"
						className={cn(
							"nav-item w-full justify-start",
							currentView === "profile" && "active",
						)}
						onClick={() => handleNavigate("profile")}
					>
						<span className="nav-icon">👤</span>
						<span className="nav-text">Min profil</span>
					</Button>

					<div className="nav-divider"></div>

					<Button
						variant="ghost"
						className="nav-item logout w-full justify-start"
						onClick={handleSignOut}
					>
						<span className="nav-icon">🚪</span>
						<span className="nav-text">Logg ut</span>
					</Button>
				</nav>
			</aside>
		</>
	);
}
