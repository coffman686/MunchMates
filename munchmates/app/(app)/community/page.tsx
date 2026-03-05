// Community Page
// Renders the social feed section of MunchMates, showcasing example posts
// and exploring the future direction of in-app community features.
// Includes:
// - Search bar with text + tag matching
// - Filters for all posts vs. trending posts
// - Interactive post cards (likes, comments, shares, bookmarks)
// - Sidebar with community stats, trending posts, and popular tags
// Behavior:
// - Uses local in-memory mock posts to demonstrate UX flow
// - Supports liking and bookmarking with optimistic UI updates
// - Placeholder for future authenticated posting + live community backend
// This page serves as a proof-of-concept for the future social experience.

'use client';

import { useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Input } from '@/components/ui/input';
import {
    MessageCircle,
    Heart,
    Bookmark,
    TrendingUp,
    Search,
    MoreHorizontal,
    Hash,
    Send,
} from 'lucide-react';

interface Post {
    id: number;
    author: string;
    avatar: string;
    image: string;
    text: string;
    likes: number;
    comments: number;
    shares: number;
    timestamp: string;
    isLiked: boolean;
    isBookmarked: boolean;
    tags: string[];
}

const Community = () => {
    const [posts, setPosts] = useState<Post[]>([
        {
            id: 1,
            author: 'Jane Doe',
            avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
            image: 'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?cs=srgb&dl=burger-chips-dinner-70497.jpg&fm=jpg',
            text: 'Just tried the Smash Burger recipe from the app, and it was amazing! The instructions were so clear and the result was restaurant-quality. Highly recommend!',
            likes: 24,
            comments: 8,
            shares: 3,
            timestamp: '2h',
            isLiked: false,
            isBookmarked: false,
            tags: ['burgers', 'dinner', 'comfort-food']
        },
        {
            id: 2,
            author: 'John Smith',
            avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e',
            image: 'https://images5.alphacoders.com/132/1322094.png',
            text: 'Made this incredible ramen from scratch last night. The broth took hours but it was so worth it. Anyone else obsessed with homemade ramen?',
            likes: 12,
            comments: 15,
            shares: 2,
            timestamp: '5h',
            isLiked: true,
            isBookmarked: true,
            tags: ['ramen', 'homemade', 'japanese']
        },
        {
            id: 3,
            author: 'Maria Garcia',
            avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f',
            image: 'https://thumbs.dreamstime.com/b/delicious-chocolate-chip-cookies-captured-high-detail-tempting-crunchy-pecans-beautifully-quality-food-photography-golden-347725977.jpg',
            text: 'Fresh batch of chocolate chip cookies straight from the oven. Used the recipe from my saved collection and they turned out perfect every time.',
            likes: 42,
            comments: 23,
            shares: 7,
            timestamp: '1d',
            isLiked: false,
            isBookmarked: true,
            tags: ['baking', 'cookies', 'dessert']
        },
        {
            id: 4,
            author: 'Alex Chen',
            avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704a',
            image: 'https://hips.hearstapps.com/hmg-prod/images/ketochickenthighs1-1645730836.jpg',
            text: 'These crispy chicken thighs are my go-to weeknight dinner. So simple but the flavor is unreal. Meal prepped a double batch for the week!',
            likes: 67,
            comments: 11,
            shares: 5,
            timestamp: '2d',
            isLiked: false,
            isBookmarked: false,
            tags: ['chicken', 'meal-prep', 'keto']
        }
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'trending'>('all');

    const popularTags = [
        'recipes', 'tips', 'vegan', 'meal-prep', 'baking',
        'quick-meals', 'healthy', 'comfort-food', 'international'
    ];

    // Mock "story" users for the stories bar
    const storyUsers = [
        { name: 'Sarah K.', avatar: 'https://i.pravatar.cc/150?u=story1', hasNew: true },
        { name: 'Mike R.', avatar: 'https://i.pravatar.cc/150?u=story2', hasNew: true },
        { name: 'Emily W.', avatar: 'https://i.pravatar.cc/150?u=story3', hasNew: true },
        { name: 'David L.', avatar: 'https://i.pravatar.cc/150?u=story4', hasNew: false },
        { name: 'Lisa M.', avatar: 'https://i.pravatar.cc/150?u=story5', hasNew: false },
        { name: 'Chris P.', avatar: 'https://i.pravatar.cc/150?u=story6', hasNew: true },
        { name: 'Amy T.', avatar: 'https://i.pravatar.cc/150?u=story7', hasNew: false },
    ];

    const trendingPosts = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 3);

    const baseFilteredPosts = posts.filter(post =>
        post.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredPosts =
        activeFilter === 'trending'
            ? baseFilteredPosts.slice().sort((a, b) => b.likes - a.likes)
            : baseFilteredPosts;

    const handleLike = (postId: number) => {
        setPosts(prev => prev.map(post =>
            post.id === postId
                ? {
                    ...post,
                    likes: post.isLiked ? post.likes - 1 : post.likes + 1,
                    isLiked: !post.isLiked
                }
                : post
        ));
    };

    const handleBookmark = (postId: number) => {
        setPosts(prev => prev.map(post =>
            post.id === postId
                ? { ...post, isBookmarked: !post.isBookmarked }
                : post
        ));
    };

    const card = 'rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]';

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <main className="flex-1 p-4 sm:p-6 bg-muted/20">
                            <div className="w-full space-y-5">

                                {/* Search + Filters */}
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search posts, users, or tags..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-10 pl-10 rounded-xl text-sm bg-muted/50 border-border/50"
                                        />
                                    </div>
                                    <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1">
                                        <button
                                            onClick={() => setActiveFilter('all')}
                                            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${
                                                activeFilter === 'all'
                                                    ? 'bg-card shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            All Posts
                                        </button>
                                        <button
                                            onClick={() => setActiveFilter('trending')}
                                            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
                                                activeFilter === 'trending'
                                                    ? 'bg-card shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <TrendingUp className="h-3.5 w-3.5" />
                                            Trending
                                        </button>
                                    </div>
                                </div>

                                {/* Main content grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                                    {/* Feed column */}
                                    <div className="lg:col-span-2 space-y-5">

                                        {/* Stories bar */}
                                        <div className={`${card} px-4 py-3`}>
                                            <div className="flex gap-4 overflow-x-auto pb-1">
                                                {storyUsers.map((user) => (
                                                    <button key={user.name} className="flex flex-col items-center gap-1.5 shrink-0 group">
                                                        <div className={`p-[2.5px] rounded-full ${
                                                            user.hasNew
                                                                ? 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600'
                                                                : 'bg-border/60'
                                                        }`}>
                                                            <div className="h-14 w-14 rounded-full overflow-hidden bg-card p-[2px]">
                                                                <img
                                                                    src={user.avatar}
                                                                    alt={user.name}
                                                                    className="h-full w-full rounded-full object-cover"
                                                                />
                                                            </div>
                                                        </div>
                                                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate w-16 text-center">
                                                            {user.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Posts */}
                                        {filteredPosts.map(post => (
                                            <div key={post.id} className={`${card} overflow-hidden`}>
                                                {/* Post header */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600">
                                                            <div className="h-9 w-9 rounded-full overflow-hidden bg-card p-[1.5px]">
                                                                <img
                                                                    src={post.avatar}
                                                                    alt={post.author}
                                                                    className="h-full w-full rounded-full object-cover"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-[13px] font-bold leading-tight">
                                                                {post.author}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {post.timestamp}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                                                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                                                    </button>
                                                </div>

                                                {/* Post image */}
                                                <div className="relative aspect-[16/9] bg-muted">
                                                    <img
                                                        src={post.image}
                                                        alt="Post"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                {/* Action bar */}
                                                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => handleLike(post.id)}
                                                            className="transition-transform active:scale-[1.2]"
                                                        >
                                                            <Heart className={`h-6 w-6 transition-colors ${
                                                                post.isLiked
                                                                    ? 'fill-red-500 text-red-500'
                                                                    : 'text-foreground hover:text-foreground/70'
                                                            }`} />
                                                        </button>
                                                        <button className="transition-transform active:scale-[1.1]">
                                                            <MessageCircle className="h-6 w-6 text-foreground hover:text-foreground/70 transition-colors" />
                                                        </button>
                                                        <button className="transition-transform active:scale-[1.1]">
                                                            <Send className="h-5 w-5 text-foreground hover:text-foreground/70 transition-colors -rotate-12" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleBookmark(post.id)}
                                                        className="transition-transform active:scale-[1.2]"
                                                    >
                                                        <Bookmark className={`h-6 w-6 transition-colors ${
                                                            post.isBookmarked
                                                                ? 'fill-foreground text-foreground'
                                                                : 'text-foreground hover:text-foreground/70'
                                                        }`} />
                                                    </button>
                                                </div>

                                                {/* Likes count */}
                                                <div className="px-4 pt-1">
                                                    <p className="text-[13px] font-bold">{post.likes.toLocaleString()} likes</p>
                                                </div>

                                                {/* Caption */}
                                                <div className="px-4 pt-1 pb-2">
                                                    <p className="text-[13px] leading-relaxed">
                                                        <span className="font-bold mr-1.5">{post.author}</span>
                                                        {post.text}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {post.tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="text-[13px] font-medium text-primary/80 cursor-pointer hover:text-primary transition-colors"
                                                            >
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Comments preview */}
                                                {post.comments > 0 && (
                                                    <button className="px-4 pb-1">
                                                        <p className="text-[13px] text-muted-foreground">
                                                            View all {post.comments} comments
                                                        </p>
                                                    </button>
                                                )}

                                                {/* Comment input */}
                                                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/30">
                                                    <div className="h-7 w-7 rounded-full overflow-hidden bg-muted shrink-0">
                                                        <img
                                                            src="https://i.pravatar.cc/150?u=currentuser"
                                                            alt="You"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <p className="text-[13px] text-muted-foreground flex-1">Add a comment...</p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Empty state */}
                                        {filteredPosts.length === 0 && (
                                            <div className={`${card} py-16 flex flex-col items-center text-center`}>
                                                <div className="flex h-14 w-14 items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'rgba(94,92,230,0.1)' }}>
                                                    <Search className="h-6 w-6" style={{ color: '#5E5CE6' }} />
                                                </div>
                                                <h3 className="text-[16px] font-semibold mb-1">No posts found</h3>
                                                <p className="text-[13px] text-muted-foreground max-w-[280px] leading-relaxed">
                                                    {searchTerm
                                                        ? 'Try adjusting your search terms.'
                                                        : 'This page showcases example community posts. Posting will be added in a future release.'
                                                    }
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Sidebar */}
                                    <div className="space-y-4">
                                        {/* Trending Posts */}
                                        <div className={card}>
                                            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(255,69,58,0.1)' }}>
                                                    <TrendingUp className="h-4 w-4" style={{ color: '#FF453A' }} />
                                                </div>
                                                <h3 className="text-[15px] font-semibold">Trending</h3>
                                            </div>
                                            <div className="px-3 pb-3">
                                                <div className="divide-y divide-border/30">
                                                    {trendingPosts.map((post) => (
                                                        <div key={post.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                                                                <img
                                                                    src={post.image}
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] font-semibold leading-snug line-clamp-2">
                                                                    {post.text.slice(0, 60)}...
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                                                    <span>{post.author}</span>
                                                                    <span className="flex items-center gap-0.5">
                                                                        <Heart className="h-3 w-3 fill-red-400 text-red-400" />
                                                                        {post.likes}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Popular Tags */}
                                        <div className={card}>
                                            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(10,132,255,0.1)' }}>
                                                    <Hash className="h-4 w-4" style={{ color: '#0A84FF' }} />
                                                </div>
                                                <h3 className="text-[15px] font-semibold">Popular Tags</h3>
                                            </div>
                                            <div className="px-5 pb-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {popularTags.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="text-[12px] font-medium text-primary bg-primary/8 hover:bg-primary/15 rounded-full px-3 py-1.5 cursor-pointer transition-colors"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
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

export default Community;
