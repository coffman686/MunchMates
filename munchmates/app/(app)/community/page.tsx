// Community Page
// Renders the global social feed of MunchMates and connects it to the posts API.
// Features:
// - Loads posts from `/api/posts` via `authedFetch`
// - "Create Post" dialog for caption + optional image/recipe/rating
// - "Munch" (like) button with optimistic toggle and count reconciliation
// - Expandable comment thread per post with inline composer
// - Owner-only post and comment deletion
// - Clickable recipe reference linking to the shared recipe detail page
//   at `/recipes/[id]` (works for both Spoonacular and custom recipes)
// - Initial-based avatar badges (no fake profile images)

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { authedFetch } from '@/lib/authedFetch';
import CreatePostDialog, { NewPost } from '@/components/community/CreatePostDialog';
import { MessageCircle, Search, Plus, Star, Utensils, Trash2 } from 'lucide-react';

type Post = NewPost;

type Comment = {
    id: string;
    text: string;
    createdAt: string;
    author: { id: string; name: string; username: string };
};

function formatRelative(iso: string) {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString();
}

function displayName(a: { name: string; username: string }) {
    return a.name?.trim() || a.username?.trim() || 'Anonymous';
}

function initials(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Muffin icon: our brand-specific "munch" vote icon.
function MuffinIcon({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            width="18"
            height="18"
            aria-hidden="true"
        >
            {/* Muffin top (dome) */}
            <path
                d="M4.5 11c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"
                fill={filled ? '#f59e0b' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Sprinkles, only when unfilled */}
            {!filled && (
                <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <line x1="9" y1="7.5" x2="9.6" y2="6.9" />
                    <line x1="12.2" y1="6.4" x2="12.8" y2="5.8" />
                    <line x1="14.8" y1="8.2" x2="15.4" y2="7.6" />
                </g>
            )}
            {/* Wrapper / liner */}
            <path
                d="M3.5 11h17l-1.6 9a2.2 2.2 0 0 1-2.2 1.8H7.3A2.2 2.2 0 0 1 5.1 20L3.5 11z"
                fill={filled ? '#fde68a' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Liner fluting */}
            <path
                d="M8.5 11.2l-.3 10M12 11.2v10M15.5 11.2l.3 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

const Community = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Per-post comment state
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
    const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
    const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
    const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
    const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { keycloak, waitForInit } = await import('@/lib/keycloak');
            await waitForInit();
            if (!cancelled) {
                const sub = keycloak.tokenParsed?.sub;
                setCurrentUserId(typeof sub === 'string' ? sub : null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const loadPosts = useCallback(async (attempt = 0) => {
        try {
            const res = await authedFetch('/api/posts');
            if (res.status === 401) {
                if (attempt < 3) {
                    setTimeout(() => loadPosts(attempt + 1), 300);
                    return;
                }
                setLoadError('Authentication is taking longer than expected. Try refreshing.');
                setIsLoading(false);
                return;
            }
            if (!res.ok) {
                setLoadError('Failed to load posts.');
                return;
            }
            const data = await res.json();
            setPosts(data.posts || []);
            setLoadError(null);
        } catch (err) {
            console.error('Error loading posts:', err);
            setLoadError('Failed to load posts.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const handlePostCreated = (post: Post) => {
        setPosts(prev => [post, ...prev]);
    };

    const handleYum = async (post: Post) => {
        setPosts(prev =>
            prev.map(p =>
                p.id === post.id
                    ? {
                          ...p,
                          likedByMe: !p.likedByMe,
                          likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1,
                      }
                    : p,
            ),
        );

        try {
            const res = await authedFetch(`/api/posts/${post.id}/like`, { method: 'POST' });
            if (!res.ok) throw new Error('Like failed');
            const data = await res.json();
            setPosts(prev =>
                prev.map(p =>
                    p.id === post.id ? { ...p, likedByMe: data.liked, likeCount: data.likeCount } : p,
                ),
            );
        } catch (err) {
            console.error('Error toggling munch:', err);
            setPosts(prev =>
                prev.map(p =>
                    p.id === post.id
                        ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }
                        : p,
                ),
            );
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Delete this post?')) return;
        try {
            const res = await authedFetch(`/api/posts/${postId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (err) {
            console.error('Error deleting post:', err);
            alert('Failed to delete post.');
        }
    };

    const toggleComments = async (postId: string) => {
        const willOpen = !openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: willOpen }));
        if (willOpen && !commentsByPost[postId]) {
            setCommentLoading(prev => ({ ...prev, [postId]: true }));
            try {
                const res = await authedFetch(`/api/posts/${postId}/comments`);
                if (!res.ok) throw new Error('Comments load failed');
                const data = await res.json();
                setCommentsByPost(prev => ({ ...prev, [postId]: data.comments || [] }));
            } catch (err) {
                console.error('Error loading comments:', err);
                alert('Failed to load comments.');
                setOpenComments(prev => ({ ...prev, [postId]: false }));
            } finally {
                setCommentLoading(prev => ({ ...prev, [postId]: false }));
            }
        }
    };

    const submitComment = async (postId: string) => {
        const text = (commentDraft[postId] || '').trim();
        if (!text) return;
        setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
        try {
            const res = await authedFetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error('Comment failed');
            const data = await res.json();
            setCommentsByPost(prev => ({
                ...prev,
                [postId]: [...(prev[postId] || []), data.comment],
            }));
            setCommentDraft(prev => ({ ...prev, [postId]: '' }));
            setPosts(prev =>
                prev.map(p => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
            );
        } catch (err) {
            console.error('Error posting comment:', err);
            alert('Failed to post comment.');
        } finally {
            setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
        }
    };

    const deleteComment = async (postId: string, commentId: string) => {
        try {
            const res = await authedFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setCommentsByPost(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
            }));
            setPosts(prev =>
                prev.map(p =>
                    p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
                ),
            );
        } catch (err) {
            console.error('Error deleting comment:', err);
            alert('Failed to delete comment.');
        }
    };

    const filteredPosts = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return posts;
        return posts.filter(
            p =>
                p.caption.toLowerCase().includes(q) ||
                displayName(p.author).toLowerCase().includes(q) ||
                (p.recipeName || '').toLowerCase().includes(q),
        );
    }, [posts, searchTerm]);

    const card =
        'rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]';

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <main className="flex-1 p-4 sm:p-6 bg-muted/20">
                            <div className="w-full max-w-3xl mx-auto space-y-5">
                                {/* Search + Create */}
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search posts, users, or recipes..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-10 pl-10 rounded-xl text-sm bg-muted/50 border-border/50"
                                        />
                                    </div>
                                    <Button
                                        onClick={() => setCreateOpen(true)}
                                        className="rounded-xl gap-1.5 h-10"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Post
                                    </Button>
                                </div>

                                {/* Feed */}
                                {isLoading ? (
                                    <div className={`${card} py-16 text-center text-sm text-muted-foreground`}>
                                        Loading posts...
                                    </div>
                                ) : loadError ? (
                                    <div className={`${card} py-16 text-center text-sm text-red-500`}>
                                        {loadError}
                                    </div>
                                ) : filteredPosts.length === 0 ? (
                                    <div className={`${card} py-16 flex flex-col items-center text-center`}>
                                        <div
                                            className="flex h-14 w-14 items-center justify-center rounded-full mb-4"
                                            style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}
                                        >
                                            <MuffinIcon className="text-amber-600" />
                                        </div>
                                        <h3 className="text-[16px] font-semibold mb-1">
                                            {searchTerm ? 'No posts found' : 'No posts yet'}
                                        </h3>
                                        <p className="text-[13px] text-muted-foreground max-w-[320px] leading-relaxed">
                                            {searchTerm
                                                ? 'Try adjusting your search.'
                                                : 'Be the first to share a recipe or a meal with the community.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        {filteredPosts.map(post => {
                                            const name = displayName(post.author);
                                            const isAuthor = currentUserId === post.author.id;
                                            const isCommentsOpen = !!openComments[post.id];

                                            return (
                                                <article
                                                    key={post.id}
                                                    className={`${card} overflow-hidden flex flex-col`}
                                                >
                                                    {/* Header: name + time, no avatar image */}
                                                    <div className="flex items-start justify-between px-5 pt-4 pb-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                                <span className="text-[13px] font-bold text-primary">
                                                                    {initials(name)}
                                                                </span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[14px] font-semibold leading-tight truncate">
                                                                    {name}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    {formatRelative(post.createdAt)} ago
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {isAuthor && (
                                                            <button
                                                                onClick={() => handleDeletePost(post.id)}
                                                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
                                                                title="Delete post"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Image */}
                                                    {post.image && (
                                                        <div className="relative aspect-[16/9] bg-muted">
                                                            <img
                                                                src={post.image}
                                                                alt="Post"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Recipe card */}
                                                    {post.recipeId && post.recipeName && (
                                                        <Link
                                                            href={`/recipes/${post.recipeId}`}
                                                            className="flex items-center gap-3 mx-4 mt-3 p-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                                                        >
                                                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                                                                {post.recipeImage ? (
                                                                    <img
                                                                        src={post.recipeImage}
                                                                        alt=""
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center">
                                                                        <Utensils className="h-5 w-5 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] font-semibold truncate">
                                                                    {post.recipeName}
                                                                </p>
                                                                <p className="text-[11px] text-muted-foreground capitalize">
                                                                    {post.recipeType} recipe
                                                                </p>
                                                            </div>
                                                            {post.rating && (
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    {[1, 2, 3, 4, 5].map(n => (
                                                                        <Star
                                                                            key={n}
                                                                            className={`h-3.5 w-3.5 ${
                                                                                n <= (post.rating || 0)
                                                                                    ? 'fill-amber-400 text-amber-400'
                                                                                    : 'text-muted-foreground/30'
                                                                            }`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </Link>
                                                    )}

                                                    {/* Caption */}
                                                    {post.caption && (
                                                        <p className="px-5 pt-3 text-[14px] leading-relaxed whitespace-pre-wrap">
                                                            {post.caption}
                                                        </p>
                                                    )}

                                                    {/* Actions: pill buttons, not an icon rail */}
                                                    <div className="flex items-center gap-2 px-5 pt-3 pb-4 mt-auto">
                                                        <button
                                                            onClick={() => handleYum(post)}
                                                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors ${
                                                                post.likedByMe
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                                                    : 'bg-muted/70 text-foreground hover:bg-muted'
                                                            }`}
                                                        >
                                                            <MuffinIcon
                                                                filled={post.likedByMe}
                                                                className={post.likedByMe ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}
                                                            />
                                                            {post.likeCount}{' '}
                                                            {post.likeCount === 1 ? 'Munch' : 'Munches'}
                                                        </button>
                                                        <button
                                                            onClick={() => toggleComments(post.id)}
                                                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors ${
                                                                isCommentsOpen
                                                                    ? 'bg-primary/10 text-primary'
                                                                    : 'bg-muted/70 text-foreground hover:bg-muted'
                                                            }`}
                                                        >
                                                            <MessageCircle className="h-4 w-4" />
                                                            {post.commentCount}{' '}
                                                            {post.commentCount === 1 ? 'Comment' : 'Comments'}
                                                        </button>
                                                    </div>

                                                    {/* Expanded comments */}
                                                    {isCommentsOpen && (
                                                        <div className="px-5 pb-5 pt-3 border-t border-border/30 bg-muted/10 space-y-3">
                                                            {commentLoading[post.id] ? (
                                                                <p className="text-[12px] text-muted-foreground">
                                                                    Loading comments...
                                                                </p>
                                                            ) : (commentsByPost[post.id] || []).length === 0 ? (
                                                                <p className="text-[12px] text-muted-foreground">
                                                                    No comments yet. Be the first to say something.
                                                                </p>
                                                            ) : (
                                                                <div className="space-y-2.5">
                                                                    {(commentsByPost[post.id] || []).map(c => {
                                                                        const cName = displayName(c.author);
                                                                        const isMine = currentUserId === c.author.id;
                                                                        return (
                                                                            <div
                                                                                key={c.id}
                                                                                className="flex items-start gap-2.5 group"
                                                                            >
                                                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                                                    <span className="text-[10px] font-bold text-primary">
                                                                                        {initials(cName)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex-1 min-w-0 rounded-xl bg-muted/60 px-3 py-2">
                                                                                    <div className="flex items-baseline gap-2">
                                                                                        <p className="text-[12.5px] font-semibold truncate">
                                                                                            {cName}
                                                                                        </p>
                                                                                        <p className="text-[10.5px] text-muted-foreground">
                                                                                            {formatRelative(c.createdAt)}
                                                                                        </p>
                                                                                    </div>
                                                                                    <p className="text-[13px] leading-snug whitespace-pre-wrap">
                                                                                        {c.text}
                                                                                    </p>
                                                                                </div>
                                                                                {isMine && (
                                                                                    <button
                                                                                        onClick={() =>
                                                                                            deleteComment(post.id, c.id)
                                                                                        }
                                                                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity mt-1"
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Comment composer */}
                                                            <form
                                                                onSubmit={(e) => {
                                                                    e.preventDefault();
                                                                    submitComment(post.id);
                                                                }}
                                                                className="flex items-center gap-2 pt-1"
                                                            >
                                                                <input
                                                                    value={commentDraft[post.id] || ''}
                                                                    onChange={(e) =>
                                                                        setCommentDraft(prev => ({
                                                                            ...prev,
                                                                            [post.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="Share your thoughts..."
                                                                    maxLength={1000}
                                                                    className="flex-1 h-9 px-3.5 rounded-full bg-card border border-border/50 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                                />
                                                                <Button
                                                                    type="submit"
                                                                    disabled={
                                                                        !(commentDraft[post.id] || '').trim() ||
                                                                        !!commentSubmitting[post.id]
                                                                    }
                                                                    className="rounded-full h-9 px-4 text-[12.5px]"
                                                                >
                                                                    {commentSubmitting[post.id] ? 'Posting...' : 'Send'}
                                                                </Button>
                                                            </form>
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>

            <CreatePostDialog
                isOpen={createOpen}
                onOpenChange={setCreateOpen}
                onPostCreated={handlePostCreated}
            />
        </RequireAuth>
    );
};

export default Community;
