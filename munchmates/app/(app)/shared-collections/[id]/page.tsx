// File: page.tsx
// Purpose: Show details for a single shared recipe collection
// Inputs: Dynamic route param id (collectionId)
// Outputs: Collection header, recipes list, members list
// Uses: authedFetch for collection/members CRUD, role-based edit controls

'use client';

import { useState, useEffect, use } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { authedFetch } from '@/lib/authedFetch';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import UserSearch, { type UserResult } from '@/components/shared-collections/UserSearch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FolderHeart,
    ArrowLeft,
    Users,
    BookOpen,
    Trash2,
    UserPlus,
    Crown,
    Eye,
    Edit,
    Clock,
    Heart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessTokenClaims } from '@/lib/keycloak';

type CollectionMember = {
    userId: string;
    userName: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
};

type SharedRecipe = {
    recipeId: number;
    recipeName: string;
    recipeImage?: string | null;
    addedBy: string;
    addedByName: string;
    addedAt: string;
};

type SharedCollection = {
    id: string;
    name: string;
    description: string;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    members: CollectionMember[];
    recipes: SharedRecipe[];
};

type PageProps = {
    params: Promise<{ id: string }>;
};

const collectionGradients = [
    'linear-gradient(135deg, #FF6B6B, #FF8E53)',
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #fccb90, #d57eeb)',
];

function getGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return collectionGradients[Math.abs(hash) % collectionGradients.length];
}

const SharedCollectionDetailPage = ({ params }: PageProps) => {
    const { id: collectionId } = use(params);
    const router = useRouter();
    const [collection, setCollection] = useState<SharedCollection | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
    const [newMemberRole, setNewMemberRole] = useState<'editor' | 'viewer'>('viewer');
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>('viewer');
    const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());

    // Load collection and saved recipes on mount
    useEffect(() => {
        loadCollection();
        const loadSaved = async () => {
            try {
                const res = await authedFetch('/api/recipes/saved');
                if (res.ok) {
                    const data = await res.json();
                    setSavedRecipeIds(new Set((data.recipes || []).map((r: { recipeId: number }) => r.recipeId)));
                }
            } catch { /* silently fail */ }
        };
        loadSaved();
    }, [collectionId]);

    const loadCollection = async () => {
        setIsLoading(true);
        try {
            const response = await authedFetch(`/api/shared-collections/${collectionId}`);
            if (response.ok) {
                const data = await response.json();
                setCollection(data.collection);
                const claims = getAccessTokenClaims<{ sub?: string }>();
                const myId = claims?.sub;
                const myMember = data.collection.members.find(
                    (m: CollectionMember) => m.userId === myId
                );
                setCurrentUserRole(myMember?.role || 'viewer');
            } else {
                router.push('/shared-collections');
            }
        } catch (error) {
            console.error('Error loading collection:', error);
            router.push('/shared-collections');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!selectedUser) return;

        setIsAddingMember(true);
        try {
            const response = await authedFetch(`/api/shared-collections/${collectionId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: selectedUser.id,
                    memberName: selectedUser.name || selectedUser.username,
                    role: newMemberRole,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCollection(data.collection);
                setSelectedUser(null);
                setNewMemberRole('viewer');
                setIsAddMemberDialogOpen(false);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to add member');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Failed to add member. Please try again.');
        } finally {
            setIsAddingMember(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;

        try {
            const response = await authedFetch(
                `/api/shared-collections/${collectionId}/members?memberId=${memberId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                const data = await response.json();
                setCollection(data.collection);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    const handleRemoveRecipe = async (recipeId: number) => {
        if (!confirm('Are you sure you want to remove this recipe from the collection?')) return;

        try {
            const response = await authedFetch(`/api/shared-collections/${collectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'removeRecipe',
                    recipeId,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCollection(data.collection);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to remove recipe');
            }
        } catch (error) {
            console.error('Error removing recipe:', error);
        }
    };

    const toggleSaveRecipe = async (recipeId: number, recipeName: string, recipeImage?: string | null) => {
        const isSaved = savedRecipeIds.has(recipeId);
        setSavedRecipeIds(prev => {
            const next = new Set(prev);
            if (isSaved) next.delete(recipeId); else next.add(recipeId);
            return next;
        });
        try {
            if (isSaved) {
                await authedFetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: 'DELETE' });
            } else {
                await authedFetch('/api/recipes/saved', {
                    method: 'POST',
                    body: JSON.stringify({ recipeId, recipeName, recipeImage }),
                });
            }
        } catch (error) {
            console.error('Error toggling saved recipe:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner':
                return <Crown className="h-3.5 w-3.5" />;
            case 'editor':
                return <Edit className="h-3.5 w-3.5" />;
            default:
                return <Eye className="h-3.5 w-3.5" />;
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const canEdit = currentUserRole === 'owner' || currentUserRole === 'editor';

    if (isLoading) {
        return (
            <RequireAuth>
                <SidebarProvider defaultOpen={false}>
                    <div className="min-h-screen flex w-full">
                        <AppSidebar />
                        <div className="flex-1 flex flex-col">
                            <main className="flex-1 p-6 bg-muted/20">
                                <div className="w-full space-y-5">
                                    {/* Back button skeleton */}
                                    <div className="h-8 w-40 rounded-full bg-muted animate-pulse" />
                                    {/* Hero skeleton */}
                                    <div className="h-40 rounded-2xl bg-muted animate-pulse" />
                                    {/* Content skeletons */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                        <div className="lg:col-span-2 h-64 rounded-2xl bg-muted animate-pulse" />
                                        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
                                    </div>
                                </div>
                            </main>
                        </div>
                    </div>
                </SidebarProvider>
            </RequireAuth>
        );
    }

    if (!collection) {
        return null;
    }

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <main className="flex-1 p-6 bg-muted/20">
                            <div className="w-full space-y-5">
                                {/* Back link */}
                                <button
                                    onClick={() => router.push('/shared-collections')}
                                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Collections
                                </button>

                                {/* Hero banner */}
                                <div
                                    className="relative rounded-2xl overflow-hidden p-6 md:p-8"
                                    style={{ background: getGradient(collection.name) }}
                                >
                                    <div className="relative z-10">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                            <div>
                                                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3 drop-shadow-md">
                                                    <FolderHeart className="h-7 w-7" />
                                                    {collection.name}
                                                </h1>
                                                {collection.description && (
                                                    <p className="text-white/80 mt-1.5 text-sm max-w-lg">
                                                        {collection.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 mt-3 text-xs text-white/70">
                                                    <span className="flex items-center gap-1">
                                                        <Crown className="h-3.5 w-3.5" />
                                                        Created by {collection.createdByName}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {formatDate(collection.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 rounded-full flex items-center gap-1.5 px-3 py-1 w-fit">
                                                {getRoleIcon(currentUserRole)}
                                                {currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                    {/* Recipes Section */}
                                    <div className="lg:col-span-2">
                                        <div className="rounded-2xl border bg-card p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-base font-semibold flex items-center gap-2">
                                                    <BookOpen className="h-4.5 w-4.5" />
                                                    Recipes ({collection.recipes.length})
                                                </h2>
                                                <Link href="/recipes">
                                                    <Button variant="outline" size="sm" className="rounded-full text-xs">
                                                        Browse Recipes
                                                    </Button>
                                                </Link>
                                            </div>
                                            {collection.recipes.length === 0 ? (
                                                <div
                                                    className="rounded-xl py-10 flex flex-col items-center text-center"
                                                    style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.06) 0%, hsl(30 90% 55% / 0.04) 50%, hsl(350 70% 60% / 0.03) 100%)' }}
                                                >
                                                    <BookOpen className="h-8 w-8 text-primary/30 mb-3" />
                                                    <h3 className="text-sm font-semibold mb-1">No recipes yet</h3>
                                                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                                                        Add recipes from your saved recipes or browse new ones
                                                    </p>
                                                    <Link href="/recipes/saved">
                                                        <Button variant="outline" size="sm" className="rounded-full text-xs">
                                                            Go to Saved Recipes
                                                        </Button>
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {collection.recipes.map((recipe) => (
                                                        <div
                                                            key={recipe.recipeId}
                                                            className="flex items-center justify-between p-3 rounded-xl border bg-background hover:bg-accent/50 transition-colors"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <Link
                                                                    href={`/recipes/${recipe.recipeId}`}
                                                                    className="text-sm font-medium hover:underline truncate block"
                                                                >
                                                                    {recipe.recipeName}
                                                                </Link>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Added by {recipe.addedByName} · {formatDate(recipe.addedAt)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-3">
                                                                <button
                                                                    onClick={() => toggleSaveRecipe(recipe.recipeId, recipe.recipeName, recipe.recipeImage)}
                                                                    className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:bg-accent transition-colors"
                                                                >
                                                                    <Heart className={`h-3.5 w-3.5 ${savedRecipeIds.has(recipe.recipeId) ? 'fill-red-500 text-red-500' : ''}`} />
                                                                </button>
                                                                <Link href={`/recipes/${recipe.recipeId}`}>
                                                                    <Button variant="default" size="sm" className="rounded-full text-xs h-7 px-3">
                                                                        View
                                                                    </Button>
                                                                </Link>
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => handleRemoveRecipe(recipe.recipeId)}
                                                                        className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Members Section */}
                                    <div>
                                        <div className="rounded-2xl border bg-card p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-base font-semibold flex items-center gap-2">
                                                    <Users className="h-4.5 w-4.5" />
                                                    Members ({collection.members.length})
                                                </h2>
                                                {canEdit && (
                                                    <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm" className="rounded-full text-xs">
                                                                <UserPlus className="h-3.5 w-3.5 mr-1" />
                                                                Add
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="rounded-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Add Member</DialogTitle>
                                                                <DialogDescription>
                                                                    Invite someone to join this collection.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4 py-4">
                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium">
                                                                        Find User
                                                                    </label>
                                                                    <UserSearch
                                                                        selectedUser={selectedUser}
                                                                        onSelect={setSelectedUser}
                                                                        onClear={() => setSelectedUser(null)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label htmlFor="memberRole" className="text-sm font-medium">
                                                                        Role
                                                                    </label>
                                                                    <Select
                                                                        value={newMemberRole}
                                                                        onValueChange={(value: 'editor' | 'viewer') => setNewMemberRole(value)}
                                                                    >
                                                                        <SelectTrigger className="rounded-xl">
                                                                            <SelectValue placeholder="Select role" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="viewer">
                                                                                <span className="flex items-center gap-2">
                                                                                    <Eye className="h-4 w-4" />
                                                                                    Viewer - Can view recipes
                                                                                </span>
                                                                            </SelectItem>
                                                                            <SelectItem value="editor">
                                                                                <span className="flex items-center gap-2">
                                                                                    <Edit className="h-4 w-4" />
                                                                                    Editor - Can add/remove recipes
                                                                                </span>
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    variant="outline"
                                                                    className="rounded-full"
                                                                    onClick={() => setIsAddMemberDialogOpen(false)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    className="rounded-full"
                                                                    onClick={handleAddMember}
                                                                    disabled={!selectedUser || isAddingMember}
                                                                >
                                                                    {isAddingMember ? 'Adding...' : 'Add Member'}
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {collection.members.map((member) => (
                                                    <div
                                                        key={member.userId}
                                                        className="flex items-center justify-between p-3 rounded-xl border bg-background"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarFallback className="text-xs">
                                                                    {getInitials(member.userName)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="text-sm font-medium">{member.userName}</p>
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] flex items-center gap-1 w-fit rounded-full px-2 py-0"
                                                                >
                                                                    {getRoleIcon(member.role)}
                                                                    {member.role}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        {currentUserRole === 'owner' && member.role !== 'owner' && (
                                                            <button
                                                                onClick={() => handleRemoveMember(member.userId)}
                                                                className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
};

export default SharedCollectionDetailPage;
