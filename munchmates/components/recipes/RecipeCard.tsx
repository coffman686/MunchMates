// RecipeCard.tsx
// Reusable recipe card with image, stats badges, and hover action overlay
// Used across recipe browse, saved, and collection pages

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Clock, Users, Star, Utensils } from 'lucide-react';
import { ReactNode } from 'react';

interface RecipeCardProps {
    id: number;
    title: string;
    image?: string;
    readyInMinutes?: number;
    servings?: number;
    score?: number;
    subtitle?: string;
    children?: ReactNode;
}

/** Swap Spoonacular image URLs to use the largest available size (636x393) */
function upscaleImage(url: string): string {
    return url.replace(/-\d+x\d+\./, '-636x393.');
}

export default function RecipeCard({ id, title, image, readyInMinutes, servings, score, subtitle, children }: RecipeCardProps) {
    return (
        <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            <Link href={`/recipes/${id}`} className="absolute inset-0 z-10" onClick={() => sessionStorage.setItem('mm_back', window.location.pathname)} />
            {image ? (
                <Image
                    src={upscaleImage(image)}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 brightness-[1.03] contrast-[1.08] saturate-[1.2]"
                />
            ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50">
                    <Utensils className="h-8 w-8 text-muted-foreground/30" />
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-orange-950/[0.08] to-transparent" />
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
                {score != null && score > 0 && (
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-[11px] font-medium text-white/90">{score}</span>
                    </div>
                )}
                {servings != null && (
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                        <Users className="h-3 w-3 text-white/80" />
                        <span className="text-[11px] font-medium text-white/90">{servings}</span>
                    </div>
                )}
                {readyInMinutes != null && (
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                        <Clock className="h-3 w-3 text-white/80" />
                        <span className="text-[11px] font-medium text-white/90">{readyInMinutes}m</span>
                    </div>
                )}
            </div>
            <div className="absolute bottom-3 left-3.5 right-3.5 z-20">
                <p className="text-[13px] font-semibold text-white truncate drop-shadow-md">{title}</p>
                {subtitle && (
                    <p className="text-[11px] text-white/70 truncate mt-0.5">{subtitle}</p>
                )}
            </div>
            {children && (
                <div className="absolute top-2.5 left-2.5 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {children}
                </div>
            )}
        </div>
    );
}
