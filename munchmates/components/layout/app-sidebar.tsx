// Application Sidebar Component
// Provides the collapsible left-hand navigation used across authenticated pages.
// Includes:
// - App logo + collapse toggle
// - Primary navigation links (Dashboard, Recipes, Planner, Pantry, etc.)
// - Footer section with Settings link
// Behavior:
// - Collapsible via icon toggle (shrinks to icon-only mode)
// - Highlights active route using Next.js pathname
// - Uses shared UI primitives (Sidebar, Avatar, Buttons)
// Central piece of the app layout used in all main views.

"use client";

import Link from "next/link";
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
} from "../ui/sidebar";
import {
    BookOpen,
    ChefHat,
    LayoutDashboard,
    CalendarDays,
    ShoppingCart,
    Warehouse,
    Users,
    Settings,
    PanelLeft,
    FolderHeart,
} from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/recipes", icon: BookOpen, label: "Recipes" },
    { href: "/shared-collections", icon: FolderHeart, label: "Shared Collections" },
    { href: "/meal-planner", icon: CalendarDays, label: "Meal Planner" },
    { href: "/grocery-list", icon: ShoppingCart, label: "Grocery List" },
    { href: "/pantry", icon: Warehouse, label: "Pantry" },
    { href: "/community", icon: Users, label: "Community" },
];

const AppSidebar = () => {
    const pathname = usePathname();
    const { toggleSidebar, state } = useSidebar();
    const collapsed = state === "collapsed";

    return (
        <Sidebar collapsible="icon" className="border-r bg-background">
            <SidebarHeader className="border-b">
                <Link href="/dashboard" className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
                    <ChefHat className="size-7 text-primary shrink-0" />
                    {!collapsed && (
                        <h2 className="text-lg font-bold tracking-tight text-sidebar-foreground">
                            MunchMates
                        </h2>
                    )}
                </Link>
            </SidebarHeader>

            <SidebarContent className="px-2 py-4">
                <SidebarMenu>
                    {navItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname.startsWith(item.href)}
                                tooltip={{ children: item.label, side: "right" }}
                            >
                                <Link href={item.href}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={toggleSidebar}
                            tooltip={{ children: collapsed ? "Expand" : "Collapse", side: "right" }}
                        >
                            <PanelLeft />
                            <span>{collapsed ? "Expand" : "Collapse"}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <div className="border-t pt-2">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild tooltip={{ children: "Settings", side: "right" }}>
                                <Link href="/profile">
                                    <Settings />
                                    <span>Settings</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
};

export default AppSidebar;
