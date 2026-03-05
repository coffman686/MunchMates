// RecipeCardSkeleton.tsx
// Loading skeleton placeholders matching RecipeCard layout
// Exports single skeleton and grid skeleton (configurable count)

export function RecipeCardSkeleton() {
    return (
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-orange-100/60 to-amber-50/40 animate-pulse">
            {/* Time badge placeholder */}
            <div className="absolute top-2.5 right-2.5 h-5 w-12 rounded-full bg-black/[0.06]" />
            {/* Title area at bottom */}
            <div className="absolute bottom-3 left-3.5 right-3.5 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded bg-black/[0.07]" />
                <div className="h-2.5 w-1/2 rounded bg-black/[0.05]" />
            </div>
        </div>
    );
}

export function RecipeGridSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <RecipeCardSkeleton key={i} />
            ))}
        </div>
    );
}
