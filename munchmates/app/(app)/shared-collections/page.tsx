// File: page.tsx
// Purpose: List and manage shared recipe collections
// Inputs: None (uses authedFetch to load current user's collections)
// Outputs: Grid of collections with create/delete actions and member/recipe counts
// Uses: Dialog for new collection, role hints, navigation to collection detail

'use client';

import { useState, useEffect, useRef } from 'react';
import { getAccessTokenClaims } from '@/lib/keycloak';
import RequireAuth from '@/components/RequireAuth';
import { authedFetch } from '@/lib/authedFetch';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    FolderHeart,
    Plus,
    Users,
    BookOpen,
    Trash2,
    Crown,
    Eye,
    Edit
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Represent user in a shared collection
type CollectionMember = {
    userId: string;
    userName: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
};

// Shared singular recipe
type SharedRecipe = {
    recipeId: number;
    recipeName: string;
    recipeImage?: string | null;
    addedBy: string;
    addedByName: string;
    addedAt: string;
};

// Shared collection fo recipes
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

const SharedCollectionsPage = () => {
    const [collections, setCollections] = useState<SharedCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionDescription, setNewCollectionDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Load collections on mount
    useEffect(() => {
        loadCollections();
    }, []);

    const loadCollections = async () => {
        setIsLoading(true);
        try {
            const response = await authedFetch('/api/shared-collections');
            if (response.ok) {
                const data = await response.json();
                setCollections(data.collections || []);
            }
        } catch (error) {
            console.error('Error loading collections:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Create a new collection from user input
    const handleCreateCollection = async () => {
        if (!newCollectionName.trim()) return;

        setIsCreating(true);
        try {
            const response = await authedFetch('/api/shared-collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCollectionName.trim(),
                    description: newCollectionDescription.trim(),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCollections(prev => [...prev, data.collection]);
                setNewCollectionName('');
                setNewCollectionDescription('');
                setIsCreateDialogOpen(false);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create collection');
            }
        } catch (error) {
            console.error('Error creating collection:', error);
            alert('Failed to create collection. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    // Delete a collection with confirmation dialog
    const handleDeleteCollection = async (e: React.MouseEvent, collectionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await authedFetch(`/api/shared-collections/${collectionId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCollections(prev => prev.filter(c => c.id !== collectionId));
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete collection');
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
            alert('Failed to delete collection. Please try again.');
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'owner':
                return { icon: <Crown className="h-3 w-3" />, label: 'Owner' };
            case 'editor':
                return { icon: <Edit className="h-3 w-3" />, label: 'Editor' };
            default:
                return { icon: <Eye className="h-3 w-3" />, label: 'Viewer' };
        }
    };

    const myIdRef = useRef<string | undefined>(undefined);
    if (!myIdRef.current) {
        myIdRef.current = getAccessTokenClaims<{ sub?: string }>()?.sub;
    }

    const getUserRole = (collection: SharedCollection): string => {
        const me = collection.members.find(m => m.userId === myIdRef.current);
        return me?.role || 'viewer';
    };

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <main className="flex-1 p-6 bg-muted/20">
                            <div className="w-full space-y-5">
                                {/* Header row */}
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-xl font-bold tracking-tight">Shared Collections</h2>
                                    <div className="flex items-center gap-2">
                                        {!isLoading && collections.length > 0 && (
                                            <Badge variant="secondary" className="rounded-full text-xs">
                                                {collections.length}
                                            </Badge>
                                        )}
                                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" className="rounded-full gap-1.5">
                                                    <Plus className="h-3.5 w-3.5" />
                                                    New Collection
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="rounded-2xl">
                                                <DialogHeader>
                                                    <DialogTitle>Create New Collection</DialogTitle>
                                                    <DialogDescription>
                                                        Create a shared collection to organize recipes with others.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <label htmlFor="name" className="text-sm font-medium">
                                                            Collection Name *
                                                        </label>
                                                        <Input
                                                            id="name"
                                                            className="rounded-xl"
                                                            placeholder="e.g., Family Favorites, Holiday Recipes"
                                                            value={newCollectionName}
                                                            onChange={(e) => setNewCollectionName(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label htmlFor="description" className="text-sm font-medium">
                                                            Description
                                                        </label>
                                                        <Input
                                                            id="description"
                                                            className="rounded-xl"
                                                            placeholder="What is this collection about?"
                                                            value={newCollectionDescription}
                                                            onChange={(e) => setNewCollectionDescription(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button
                                                        variant="outline"
                                                        className="rounded-full"
                                                        onClick={() => setIsCreateDialogOpen(false)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        className="rounded-full"
                                                        onClick={handleCreateCollection}
                                                        disabled={!newCollectionName.trim() || isCreating}
                                                    >
                                                        {isCreating ? 'Creating...' : 'Create Collection'}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>

                                {/* Content */}
                                {isLoading ? (
                                    /* Loading skeleton */
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
                                        ))}
                                    </div>
                                ) : collections.length === 0 ? (
                                    /* Empty state */
                                    <div
                                        className="rounded-2xl py-16 flex flex-col items-center text-center"
                                        style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.10) 0%, hsl(30 90% 55% / 0.08) 50%, hsl(350 70% 60% / 0.05) 100%)' }}
                                    >
                                        <FolderHeart className="h-10 w-10 text-primary/40 mb-4" />
                                        <h3 className="text-lg font-semibold mb-1">Start sharing recipes</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mb-6">
                                            Create a collection to organize and share your favorite recipes with friends and family.
                                        </p>
                                        <Button className="rounded-full" onClick={() => setIsCreateDialogOpen(true)}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Your First Collection
                                        </Button>
                                    </div>
                                ) : (
                                    /* Collection grid */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {collections.map((collection) => {
                                            const role = getUserRole(collection);
                                            const { icon, label } = getRoleLabel(role);
                                            const images = collection.recipes
                                                .map(r => r.recipeImage)
                                                .filter((img): img is string => !!img)
                                                .slice(0, 4);
                                            return (
                                                <Link
                                                    key={collection.id}
                                                    href={`/shared-collections/${collection.id}`}
                                                    className="group relative rounded-2xl overflow-hidden bg-card border shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out hover:shadow-lg hover:scale-[1.01]"
                                                >
                                                    {/* Gradient accent strip */}
                                                    <div className="h-2 w-full" style={{ background: getGradient(collection.name) }} />

                                                    {/* Thumbnail grid */}
                                                    <div className="p-3 pb-0">
                                                        {images.length > 0 ? (
                                                            <div className={`grid gap-1.5 rounded-xl overflow-hidden ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                                {images.map((img, i) => (
                                                                    <div key={i} className="relative aspect-[3/2] bg-muted">
                                                                        <Image
                                                                            src={img.replace(/-\d+x\d+\./, '-312x231.')}
                                                                            alt=""
                                                                            fill
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="flex items-center justify-center rounded-xl aspect-[3/2]"
                                                                style={{ background: getGradient(collection.name), opacity: 0.15 }}
                                                            >
                                                                <FolderHeart className="h-8 w-8 text-muted-foreground/40" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="p-3 pt-2.5">
                                                        <p className="text-sm font-semibold line-clamp-1">{collection.name}</p>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <BookOpen className="h-3 w-3" />
                                                                {collection.recipes.length} recipes
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Users className="h-3 w-3" />
                                                                {collection.members.length} members
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 flex items-center gap-1">
                                                                {icon}
                                                                {label}
                                                            </Badge>
                                                            {role === 'owner' && (
                                                                <button
                                                                    onClick={(e) => handleDeleteCollection(e, collection.id)}
                                                                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
};

export default SharedCollectionsPage;
