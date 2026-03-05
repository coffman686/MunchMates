"use client";

import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import {
    initKeycloak,
    ensureToken,
    getAccessTokenClaims,
    logout,
} from "@/lib/keycloak";
import { LogOut, User, ShieldAlert, Trash2, Save, Leaf, AlertTriangle, Globe } from "lucide-react";

type AccessTokenClaims = {
    sub?: string;
    email?: string;
    preferred_username?: string;
    name?: string;
};

const allDiets = [
    "Gluten Free", "Ketogenic", "Vegetarian", "Lacto-Vegetarian",
    "Ovo-Vegetarian", "Vegan", "Pescetarian", "Paleo", "Primal",
    "Low FODMAP", "Whole30",
];

const allIntolerances = [
    "Dairy", "Egg", "Gluten", "Grain", "Peanut", "Seafood",
    "Sesame", "Shellfish", "Soy", "Sulfite", "Tree Nut", "Wheat",
];

const allCuisines = [
    "African", "Asian", "American", "British", "Cajun", "Caribbean",
    "Chinese", "Eastern European", "European", "French", "German",
    "Greek", "Indian", "Irish", "Italian", "Japanese", "Jewish",
    "Korean", "Latin American", "Mediterranean", "Mexican",
    "Middle Eastern", "Nordic", "Southern", "Spanish", "Thai", "Vietnamese",
];

function toggleItem(item: string, setItems: Dispatch<SetStateAction<string[]>>) {
    setItems(prev =>
        prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]
    );
}

function ChipGrid({ items, selected, onToggle }: {
    items: string[];
    selected: string[];
    onToggle: (item: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map(item => {
                const active = selected.includes(item);
                return (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onToggle(item)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                            active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-foreground/70 hover:bg-muted"
                        }`}
                    >
                        {item}
                    </button>
                );
            })}
        </div>
    );
}

const ProfilePage = () => {
    const router = useRouter();

    const [authReady, setAuthReady] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
    const [diets, setDiets] = useState<string[]>([]);
    const [intolerances, setIntolerances] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Load diets/intolerances from localStorage on mount
    useEffect(() => {
        const localDiets = localStorage.getItem("diets");
        if (localDiets) setDiets(JSON.parse(localDiets));
        const localIntolerances = localStorage.getItem("intolerances");
        if (localIntolerances) setIntolerances(JSON.parse(localIntolerances));
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const authed = await initKeycloak("login-required");
                if (!mounted || !authed) return;
                setAuthReady(true);
                const claims = getAccessTokenClaims<AccessTokenClaims>();
                if (claims) {
                    setName(claims.name ?? claims.preferred_username ?? claims.sub ?? "");
                    setEmail(claims.email ?? "");
                }
            } catch (err) {
                console.error("Error initializing Keycloak on profile page", err);
            }
        })();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!authReady) return;
        const loadProfile = async () => {
            try {
                const token = await ensureToken();
                if (!token) return;
                const res = await fetch("/api/profile", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.favoriteCuisines) {
                    const parsed = typeof data.favoriteCuisines === "string"
                        ? data.favoriteCuisines.split(",").map((s: string) => s.trim()).filter(Boolean)
                        : data.favoriteCuisines;
                    setFavoriteCuisines(parsed);
                }
                if (data.diets) setDiets(data.diets);
                if (data.intolerances) setIntolerances(data.intolerances);
            } catch (err) {
                console.error("Error loading profile", err);
            }
        };
        loadProfile();
    }, [authReady]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Sync to localStorage for other components that read from there
            localStorage.setItem("diets", JSON.stringify(diets));
            localStorage.setItem("intolerances", JSON.stringify(intolerances));

            const token = await ensureToken();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch("/api/profile", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    favoriteCuisines: favoriteCuisines.join(", "),
                    diets,
                    intolerances,
                }),
            });
            if (!res.ok) { setSaving(false); return; }
            setSaving(false);
        } catch (err) {
            console.error("Error saving profile", err);
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete your account? This action cannot be undone."
        );
        if (!confirmed) return;
        try {
            setDeleting(true);
            const token = await ensureToken();
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch("/api/account", { method: "DELETE", headers });
            if (!res.ok) { setDeleting(false); return; }
            await logout(window.location.origin);
        } catch (err) {
            console.error("Error deleting account", err);
            setDeleting(false);
        }
    };

    const card = "rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]";

    return (
        <SidebarProvider defaultOpen={false}>
            <div className="min-h-screen flex w-full">
                <AppSidebar />
                <div className="flex-1 flex flex-col">
                    <main className="flex-1 p-4 sm:p-6 bg-muted/20">
                        <div className="w-full max-w-2xl mx-auto space-y-5">
                            <form onSubmit={handleSubmit} className="space-y-5">

                                {/* Account */}
                                <div className={card}>
                                    <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(10,132,255,0.1)" }}>
                                            <User className="h-4 w-4" style={{ color: "#0A84FF" }} />
                                        </div>
                                        <h2 className="text-[15px] font-semibold">Account</h2>
                                    </div>
                                    <div className="px-5 pb-4 divide-y divide-border/30">
                                        <div className="flex items-center justify-between py-3">
                                            <span className="text-[13px] text-muted-foreground">Name</span>
                                            <span className="text-[13px] font-medium">{name || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3">
                                            <span className="text-[13px] text-muted-foreground">Email</span>
                                            <span className="text-[13px] font-medium">{email || "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Favorite Cuisines */}
                                <div className={card}>
                                    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(48,209,88,0.1)" }}>
                                            <Globe className="h-4 w-4" style={{ color: "#30D158" }} />
                                        </div>
                                        <h2 className="text-[15px] font-semibold">Favorite Cuisines</h2>
                                    </div>
                                    <div className="px-5 pb-4 pt-2">
                                        <ChipGrid
                                            items={allCuisines}
                                            selected={favoriteCuisines}
                                            onToggle={(c) => toggleItem(c, setFavoriteCuisines)}
                                        />
                                    </div>
                                </div>

                                {/* Dietary Preferences */}
                                <div className={card}>
                                    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,159,10,0.1)" }}>
                                            <Leaf className="h-4 w-4" style={{ color: "#FF9F0A" }} />
                                        </div>
                                        <h2 className="text-[15px] font-semibold">Dietary Preferences</h2>
                                    </div>
                                    <div className="px-5 pb-4 pt-2">
                                        <ChipGrid
                                            items={allDiets}
                                            selected={diets}
                                            onToggle={(d) => toggleItem(d, setDiets)}
                                        />
                                    </div>
                                </div>

                                {/* Allergies / Intolerances */}
                                <div className={card}>
                                    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,69,58,0.1)" }}>
                                            <AlertTriangle className="h-4 w-4" style={{ color: "#FF453A" }} />
                                        </div>
                                        <h2 className="text-[15px] font-semibold">Allergies &amp; Intolerances</h2>
                                    </div>
                                    <div className="px-5 pb-4 pt-2">
                                        <ChipGrid
                                            items={allIntolerances}
                                            selected={intolerances}
                                            onToggle={(i) => toggleItem(i, setIntolerances)}
                                        />
                                    </div>
                                </div>

                                {/* Save */}
                                <Button type="submit" className="w-full h-11 rounded-xl text-[14px] font-semibold" disabled={saving}>
                                    <Save className="h-4 w-4 mr-2" />
                                    {saving ? "Saving..." : "Save Changes"}
                                </Button>

                                {/* Account Actions */}
                                <div className={card}>
                                    <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(94,92,230,0.1)" }}>
                                            <ShieldAlert className="h-4 w-4" style={{ color: "#5E5CE6" }} />
                                        </div>
                                        <h2 className="text-[15px] font-semibold">Account Actions</h2>
                                    </div>
                                    <div className="px-5 pb-4 divide-y divide-border/30">
                                        <button
                                            type="button"
                                            onClick={() => logout()}
                                            className="flex items-center gap-3 w-full py-3"
                                        >
                                            <LogOut className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-[13px] font-medium">Sign Out</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteAccount}
                                            disabled={deleting}
                                            className="flex items-center gap-3 w-full py-3"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                            <span className="text-[13px] font-medium text-red-500">
                                                {deleting ? "Removing account..." : "Delete Account"}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
};

export default ProfilePage;
