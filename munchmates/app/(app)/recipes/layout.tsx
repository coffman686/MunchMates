// File: layout.tsx
// Purpose: Provide layout for recipe pages with tab navigation
// Inputs: children (main content)
// Outputs: Combined page layout with tab bar and content area

'use client';

import RequireAuth from '@/components/RequireAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
    { label: 'Search', href: '/recipes' },
    { label: 'Saved', href: '/recipes/saved' },
    { label: 'My Recipes', href: '/recipes/my-recipes' },
];

export default function RecipesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Hide tabs when viewing a specific recipe detail page
    const isDetailPage = /^\/recipes\/\d+/.test(pathname) || pathname === '/recipes/create';

    const isActive = (href: string) => {
        if (href === '/recipes') return pathname === '/recipes';
        return pathname.startsWith(href);
    };

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        {!isDetailPage && (
                            <nav className="border-b px-6">
                                <div className="flex justify-center gap-1">
                                    {tabs.map((tab) => (
                                        <Link
                                            key={tab.href}
                                            href={tab.href}
                                            className={`relative px-5 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                                                isActive(tab.href)
                                                    ? 'text-primary bg-primary/10'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                            }`}
                                        >
                                            {tab.label}
                                            {isActive(tab.href) && (
                                                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </nav>
                        )}
                        <main className={isDetailPage ? "flex-1" : "flex-1 p-6 bg-muted/20"}>
                            {children}
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
}
