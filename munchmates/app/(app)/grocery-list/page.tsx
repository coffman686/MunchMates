'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Trash2, Plus, ShoppingCart, CheckCircle2, PencilLine, X, Save,
    CalendarDays, Loader2, ChevronDown, ChevronRight, Settings, Camera, Search,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import ImageClassificationDialog from '@/components/image-classification-dialog';
import { authedFetch } from '@/lib/authedFetch';
import ApiErrorBanner from '@/components/ui/api-error-banner';
import { assertOk, getErrorMessage, isValidationError } from '@/lib/apiClient';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { AggregatedIngredient } from '@/lib/types/meal-plan';

const CATEGORY_THEMES: Record<string, { icon: string; bg: string; text: string; border: string; badge: string }> = {
    'Produce':            { icon: '🥬', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
    'Dairy':              { icon: '🧀', bg: 'bg-sky-50',      text: 'text-sky-700',     border: 'border-l-sky-400',     badge: 'bg-sky-100 text-sky-700' },
    'Meat & Seafood':     { icon: '🥩', bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-l-rose-400',    badge: 'bg-rose-100 text-rose-700' },
    'Bakery':             { icon: '🍞', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-l-amber-400',   badge: 'bg-amber-100 text-amber-700' },
    'Frozen':             { icon: '🧊', bg: 'bg-cyan-50',     text: 'text-cyan-700',    border: 'border-l-cyan-400',    badge: 'bg-cyan-100 text-cyan-700' },
    'Spices & Seasonings':{ icon: '🌶️', bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-l-orange-400',  badge: 'bg-orange-100 text-orange-700' },
    'Canned Goods':       { icon: '🥫', bg: 'bg-slate-50',    text: 'text-slate-700',   border: 'border-l-slate-400',   badge: 'bg-slate-100 text-slate-700' },
    'Pasta & Grains':     { icon: '🍝', bg: 'bg-yellow-50',   text: 'text-yellow-700',  border: 'border-l-yellow-400',  badge: 'bg-yellow-100 text-yellow-700' },
    'Condiments':         { icon: '🫙', bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-l-purple-400',  badge: 'bg-purple-100 text-purple-700' },
    'Oils & Vinegars':    { icon: '🫒', bg: 'bg-lime-50',     text: 'text-lime-700',    border: 'border-l-lime-400',    badge: 'bg-lime-100 text-lime-700' },
    'Baking':             { icon: '🧁', bg: 'bg-pink-50',     text: 'text-pink-700',    border: 'border-l-pink-400',    badge: 'bg-pink-100 text-pink-700' },
    'Beverages':          { icon: '🥤', bg: 'bg-teal-50',     text: 'text-teal-700',    border: 'border-l-teal-400',    badge: 'bg-teal-100 text-teal-700' },
    'Pantry':             { icon: '🏠', bg: 'bg-stone-50',    text: 'text-stone-700',   border: 'border-l-stone-400',   badge: 'bg-stone-100 text-stone-700' },
};

const DEFAULT_THEME = { icon: '📦', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-l-gray-400', badge: 'bg-gray-100 text-gray-700' };

function getCategoryTheme(category: string) {
    return CATEGORY_THEMES[category] || DEFAULT_THEME;
}

interface GroceryItem {
    id: number;
    name: string;
    category: string;
    completed: boolean;
    quantity?: string | null;
    fromMealPlan?: boolean;
    addedAt: string;
}

interface GroceryCategory {
    id: number;
    name: string;
    sortOrder: number;
}

type RetryAction = () => void | Promise<void>;

function GroceryListContent() {
    const searchParams = useSearchParams();
    const [newItem, setNewItem] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [items, setItems] = useState<GroceryItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'mealplan'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [importedCount, setImportedCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [apiError, setApiError] = useState<{ message: string; isValidation: boolean; onRetry?: RetryAction } | null>(null);

    const [newItemQuantity, setNewItemQuantity] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editQuantity, setEditQuantity] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [imageDialogOpen, setImageDialogOpen] = useState(false);

    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [showCategoryPopover, setShowCategoryPopover] = useState(false);
    const categoryPopoverRef = useRef<HTMLDivElement>(null);

    // Close category popover on outside click
    useEffect(() => {
        if (!showCategoryPopover) return;
        const handleClick = (e: MouseEvent) => {
            if (categoryPopoverRef.current && !categoryPopoverRef.current.contains(e.target as Node)) {
                setShowCategoryPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showCategoryPopover]);

    const toggleCategoryCollapse = (category: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category); else next.add(category);
            return next;
        });
    };

    const clearError = () => setApiError(null);

    const setUiError = (error: unknown, fallbackMessage: string, onRetry?: RetryAction) => {
        setApiError({
            message: getErrorMessage(error, fallbackMessage),
            isValidation: isValidationError(error),
            onRetry,
        });
    };

    const fetchItems = useCallback(async () => {
        try {
            const res = await authedFetch('/api/grocery');
            await assertOk(res, 'Failed to fetch grocery items');
            const data = await res.json();
            setItems(data.items || []);
        } catch (error) {
            setUiError(error, 'Failed to fetch grocery items', fetchItems);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await authedFetch('/api/grocery/categories');
            await assertOk(res, 'Failed to fetch categories');
            const data = await res.json();
            const cats: GroceryCategory[] = data.categories || [];
            setCategories(cats.map(c => c.name));
        } catch (error) {
            setUiError(error, 'Failed to fetch categories', fetchCategories);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            clearError();
            await Promise.all([fetchItems(), fetchCategories()]);
            setIsLoading(false);
        };
        loadData();
    }, [fetchItems, fetchCategories]);

    useEffect(() => {
        if (isLoading) return;
        const fromMealPlan = searchParams.get('fromMealPlan');
        if (fromMealPlan === 'true') {
            const pendingData = localStorage.getItem('pending-grocery-items');
            if (pendingData) {
                (async () => {
                    try {
                        const aggregatedItems: AggregatedIngredient[] = JSON.parse(pendingData);
                        const res = await authedFetch('/api/grocery/import', {
                            method: 'POST',
                            body: JSON.stringify({ items: aggregatedItems }),
                        });
                        await assertOk(res, 'Failed to import grocery items');
                        const data = await res.json();
                        setImportedCount(data.addedCount || 0);
                        clearError();
                        await Promise.all([fetchItems(), fetchCategories()]);
                        localStorage.removeItem('pending-grocery-items');
                        window.history.replaceState({}, '', '/grocery-list');
                        setTimeout(() => setImportedCount(0), 5000);
                    } catch (error) {
                        setUiError(error, 'Failed to import grocery items', () => {
                            void Promise.all([fetchItems(), fetchCategories()]);
                        });
                    }
                })();
            }
        }
    }, [searchParams, isLoading, fetchItems, fetchCategories]);

    const beginEdit = (item: GroceryItem) => {
        setEditingId(item.id);
        setEditName(item.name);
        setEditQuantity(item.quantity ?? '');
        setEditCategory(item.category);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditQuantity('');
        setEditCategory('');
    };

    const saveEdit = async (id: number) => {
        clearError();
        setIsSaving(true);
        try {
            const res = await authedFetch('/api/grocery', {
                method: 'PUT',
                body: JSON.stringify({
                    id,
                    name: editName.trim(),
                    quantity: editQuantity.trim() || null,
                    category: editCategory,
                }),
            });
            await assertOk(res, 'Failed to update grocery item');
            const data = await res.json();
            setItems(prev => prev.map(it => it.id === id ? data.item : it));
            cancelEdit();
        } catch (error) {
            setUiError(error, 'Failed to update grocery item', () => saveEdit(id));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditKey = (e: React.KeyboardEvent, id: number) => {
        if (e.key === 'Enter') saveEdit(id);
        if (e.key === 'Escape') cancelEdit();
    };

    const addItem = async () => {
        if (!newItem.trim()) return;
        clearError();
        const category = newItemCategory || categories[0] || 'Uncategorized';
        const quantity = newItemQuantity.trim() || null;
        setIsSaving(true);
        try {
            const res = await authedFetch('/api/grocery', {
                method: 'POST',
                body: JSON.stringify({ name: newItem.trim(), category, quantity }),
            });
            await assertOk(res, 'Failed to add grocery item');
            const data = await res.json();
            setItems(prev => {
                const existingIndex = prev.findIndex(i => i.id === data.item.id);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = data.item;
                    return updated;
                }
                return [data.item, ...prev];
            });
            setNewItem('');
            setNewItemQuantity('');
        } catch (error) {
            setUiError(error, 'Failed to add grocery item', addItem);
        } finally {
            setIsSaving(false);
        }
    };

    const addCategory = async () => {
        if (!newCategory.trim() || categories.includes(newCategory.trim())) return;
        clearError();
        try {
            const res = await authedFetch('/api/grocery/categories', {
                method: 'POST',
                body: JSON.stringify({ name: newCategory.trim() }),
            });
            await assertOk(res, 'Failed to add category');
            const data = await res.json();
            setCategories(prev => [...prev, data.category.name]);
            setNewCategory('');
        } catch (error) {
            setUiError(error, 'Failed to add category', addCategory);
        }
    };

    const toggleItem = async (id: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        clearError();
        try {
            const res = await authedFetch('/api/grocery', {
                method: 'PUT',
                body: JSON.stringify({ id, completed: !item.completed }),
            });
            await assertOk(res, 'Failed to update grocery item');
            const data = await res.json();
            setItems(prev => prev.map(it => it.id === id ? data.item : it));
        } catch (error) {
            setUiError(error, 'Failed to toggle grocery item', () => toggleItem(id));
        }
    };

    const deleteItem = async (id: number) => {
        clearError();
        try {
            const res = await authedFetch(`/api/grocery?id=${id}`, { method: 'DELETE' });
            await assertOk(res, 'Failed to delete grocery item');
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            setUiError(error, 'Failed to delete grocery item', () => deleteItem(id));
        }
    };

    const deleteCategory = async (category: string) => {
        clearError();
        try {
            const res = await authedFetch(`/api/grocery/categories?name=${encodeURIComponent(category)}`, {
                method: 'DELETE',
            });
            await assertOk(res, 'Failed to delete category');
            const data = await res.json();
            setCategories(prev => prev.filter(c => c !== category));
            setItems(prev => prev.map(item =>
                item.category === category ? { ...item, category: data.reassignedTo } : item
            ));
        } catch (error) {
            setUiError(error, 'Failed to delete category', () => deleteCategory(category));
        }
    };

    const clearCompleted = async () => {
        clearError();
        try {
            const res = await authedFetch('/api/grocery/clear', {
                method: 'POST',
                body: JSON.stringify({ action: 'completed' }),
            });
            await assertOk(res, 'Failed to clear completed items');
            setItems(prev => prev.filter(item => !item.completed));
        } catch (error) {
            setUiError(error, 'Failed to clear completed items', clearCompleted);
        }
    };

    const clearAll = async () => {
        clearError();
        try {
            const res = await authedFetch('/api/grocery/clear', {
                method: 'POST',
                body: JSON.stringify({ action: 'all' }),
            });
            await assertOk(res, 'Failed to clear grocery list');
            setItems([]);
            cancelEdit();
        } catch (error) {
            setUiError(error, 'Failed to clear all items', clearAll);
        }
    };

    const filteredItems = items.filter(item => {
        if (filter === 'active' && item.completed) return false;
        if (filter === 'completed' && !item.completed) return false;
        if (filter === 'mealplan' && !item.fromMealPlan) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
        }
        return true;
    });

    const getItemsByCategory = (category: string) => {
        const catItems = filteredItems.filter(item => item.category === category);
        return [...catItems.filter(i => !i.completed), ...catItems.filter(i => i.completed)];
    };

    const totalItems = items.length;
    const completedItems = items.filter(item => item.completed).length;
    const activeItems = totalItems - completedItems;

    const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter') action();
    };

    return (
        <SidebarProvider defaultOpen={false}>
            <div className="min-h-screen flex w-full">
                <AppSidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <main className="flex-1 p-4 sm:p-6 bg-muted/30">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                        <div className="w-full space-y-3">
                            {apiError && (
                                <ApiErrorBanner
                                    message={apiError.message}
                                    isValidation={apiError.isValidation}
                                    onDismiss={clearError}
                                    onRetry={() => {
                                        if (apiError.onRetry) { void apiError.onRetry(); return; }
                                        void Promise.all([fetchItems(), fetchCategories()]);
                                    }}
                                />
                            )}

                            {/* Header: title + stats + photo button */}
                            <div
                                className="rounded-2xl px-4 sm:px-6 py-4 shadow-sm"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.22) 0%, hsl(30 90% 55% / 0.15) 50%, hsl(350 70% 60% / 0.10) 100%)',
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm shadow-sm">
                                            <ShoppingCart className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h1 className="text-lg font-bold text-foreground leading-tight">Grocery List</h1>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[12px] text-foreground/60">
                                                    <span className="font-bold" style={{ color: '#0A84FF' }}>{activeItems}</span> to buy
                                                </span>
                                                <span className="text-foreground/20">|</span>
                                                <span className="text-[12px] text-foreground/60">
                                                    <span className="font-bold" style={{ color: '#30D158' }}>{completedItems}</span> done
                                                </span>
                                                {totalItems > 0 && (
                                                    <>
                                                        <div className="w-16 h-1.5 bg-white/40 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${(completedItems / totalItems) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-foreground/40">
                                                            {Math.round((completedItems / totalItems) * 100)}%
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {importedCount > 0 && (
                                            <span className="flex items-center gap-1.5 rounded-full bg-green-100/80 dark:bg-green-900/30 backdrop-blur-sm px-3 py-1 text-[12px] font-semibold text-green-700 dark:text-green-400">
                                                <CalendarDays className="h-3 w-3" />
                                                Added {importedCount} from meal plan
                                            </span>
                                        )}
                                        <Button
                                            onClick={() => setImageDialogOpen(true)}
                                            className="rounded-full h-9 px-5 shadow-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
                                        >
                                            <Camera className="h-4 w-4 mr-1.5" />
                                            Add by Photo
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Add item form */}
                            <div className="rounded-2xl bg-card shadow-sm border border-border/50 px-4 sm:px-5 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1 min-w-[120px]">
                                        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                        <Input
                                            placeholder="Add an item..."
                                            value={newItem}
                                            onChange={(e) => setNewItem(e.target.value)}
                                            onKeyDown={(e) => handleKeyPress(e, addItem)}
                                            className="h-10 pl-9 rounded-xl text-sm"
                                        />
                                    </div>
                                    <Input
                                        placeholder="Qty"
                                        value={newItemQuantity}
                                        onChange={(e) => setNewItemQuantity(e.target.value)}
                                        onKeyDown={(e) => handleKeyPress(e, addItem)}
                                        className="w-20 h-10 rounded-xl text-sm"
                                    />
                                    <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                                        <SelectTrigger className="w-[140px] h-10 rounded-xl text-sm">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={addItem}
                                        disabled={isSaving}
                                        className="rounded-xl h-10 px-5 shadow-sm"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                                    </Button>

                                    {/* Category management gear */}
                                    <div className="relative" ref={categoryPopoverRef}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowCategoryPopover(!showCategoryPopover)}
                                            className="rounded-xl h-10 w-10 flex-shrink-0"
                                            title="Manage categories"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </Button>

                                        {showCategoryPopover && (
                                            <div className="absolute right-0 top-full mt-2 w-72 bg-card border rounded-2xl shadow-xl p-4 z-[100] space-y-3">
                                                <h4 className="text-sm font-semibold">Categories</h4>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="New category..."
                                                        value={newCategory}
                                                        onChange={(e) => setNewCategory(e.target.value)}
                                                        onKeyDown={(e) => handleKeyPress(e, addCategory)}
                                                        className="h-8 rounded-lg text-sm"
                                                    />
                                                    <Button size="sm" onClick={addCategory} className="rounded-lg h-8 px-3">
                                                        Add
                                                    </Button>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                                    {categories.map(category => (
                                                        <Badge key={category} variant="outline" className="text-xs gap-1 pr-1">
                                                            {category}
                                                            <button
                                                                onClick={() => deleteCategory(category)}
                                                                className="ml-0.5 hover:text-red-500 transition-colors rounded-full p-0.5"
                                                            >
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Search + filter toolbar */}
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <Input
                                        placeholder="Search your grocery list..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-9 pl-10 rounded-full text-sm bg-card border-border/50 shadow-sm placeholder:text-muted-foreground/40"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-muted/60 rounded-full p-0.5 flex-shrink-0">
                                    {([
                                        { value: 'all', label: 'All' },
                                        { value: 'active', label: 'To Buy' },
                                        { value: 'completed', label: 'Done' },
                                        { value: 'mealplan', label: 'Meal Plan' },
                                    ] as const).map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFilter(opt.value)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                                filter === opt.value
                                                    ? 'bg-white shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category list */}
                            {totalItems > 0 ? (
                                <div className="rounded-2xl bg-card shadow-sm border border-border/50 overflow-hidden">
                                    <div className="divide-y divide-border/30">
                                        {categories.map(category => {
                                            const categoryItems = getItemsByCategory(category);
                                            if (categoryItems.length === 0) return null;
                                            const isCollapsed = collapsedCategories.has(category);
                                            const theme = getCategoryTheme(category);

                                            return (
                                                <div key={category}>
                                                    <button
                                                        onClick={() => toggleCategoryCollapse(category)}
                                                        className={`w-full flex items-center justify-between px-4 sm:px-5 py-2.5 transition-colors ${theme.bg} hover:brightness-95`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            {isCollapsed
                                                                ? <ChevronRight className={`h-4 w-4 ${theme.text} opacity-60`} />
                                                                : <ChevronDown className={`h-4 w-4 ${theme.text} opacity-60`} />
                                                            }
                                                            <span className="text-base">{theme.icon}</span>
                                                            <span className={`text-[14px] font-semibold ${theme.text}`}>{category}</span>
                                                        </div>
                                                        <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${theme.badge}`}>
                                                            {categoryItems.length}
                                                        </span>
                                                    </button>

                                                    {!isCollapsed && (
                                                        <ul className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-2 sm:px-3 pb-2 gap-x-2 border-l-[3px] ${theme.border} ml-4 sm:ml-5 mt-1 mb-1`}>
                                                            {categoryItems.map((item) => {
                                                                const isEditing = editingId === item.id;

                                                                return (
                                                                    <li
                                                                        key={item.id}
                                                                        className={`group flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                                                                            item.completed ? 'bg-muted/20' : 'hover:bg-muted/20'
                                                                        }`}
                                                                    >
                                                                        <button
                                                                            onClick={() => toggleItem(item.id)}
                                                                            className={`flex-shrink-0 h-4 w-4 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
                                                                                item.completed
                                                                                    ? 'border-green-500 bg-green-500 text-white'
                                                                                    : 'border-gray-300 hover:border-green-500'
                                                                            }`}
                                                                        >
                                                                            {item.completed && <CheckCircle2 className="h-2.5 w-2.5" />}
                                                                        </button>

                                                                        {!isEditing ? (
                                                                            <>
                                                                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                                                    <span className={`text-[13px] font-medium truncate ${
                                                                                        item.completed ? 'line-through text-muted-foreground' : ''
                                                                                    }`}>
                                                                                        {item.name}
                                                                                    </span>
                                                                                    {item.quantity && (
                                                                                        <span className="text-[11px] text-muted-foreground shrink-0">{item.quantity}</span>
                                                                                    )}
                                                                                    {item.fromMealPlan && (
                                                                                        <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" title="From meal plan" />
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        onClick={() => beginEdit(item)}
                                                                                        className="h-6 w-6 rounded"
                                                                                        title="Edit"
                                                                                    >
                                                                                        <PencilLine className="h-3 w-3" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        onClick={() => deleteItem(item.id)}
                                                                                        className="h-6 w-6 rounded hover:bg-red-100 hover:text-red-600"
                                                                                        title="Delete"
                                                                                    >
                                                                                        <Trash2 className="h-2.5 w-2.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                                    <Input
                                                                                        autoFocus
                                                                                        placeholder="Name"
                                                                                        value={editName}
                                                                                        onChange={(e) => setEditName(e.target.value)}
                                                                                        onKeyDown={(e) => handleEditKey(e, item.id)}
                                                                                        className="h-8 rounded-lg text-sm"
                                                                                    />
                                                                                    <Input
                                                                                        placeholder="Quantity"
                                                                                        value={editQuantity}
                                                                                        onChange={(e) => setEditQuantity(e.target.value)}
                                                                                        onKeyDown={(e) => handleEditKey(e, item.id)}
                                                                                        className="h-8 rounded-lg text-sm"
                                                                                    />
                                                                                    <Select value={editCategory} onValueChange={setEditCategory}>
                                                                                        <SelectTrigger
                                                                                            className="h-8 rounded-lg text-sm bg-background"
                                                                                            onKeyDown={(e) => handleEditKey(e, item.id)}
                                                                                        >
                                                                                            <SelectValue />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {[...new Set([item.category, ...categories])].map((cat) => (
                                                                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                                            ))}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <Button size="sm" onClick={() => saveEdit(item.id)} disabled={isSaving} className="h-7 rounded-lg text-xs">
                                                                                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                                                                        Save
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 rounded-lg text-xs">
                                                                                        <X className="h-3 w-3 mr-1" />
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bottom action row */}
                                    {(completedItems > 0 || totalItems > 0) && (
                                        <div className="flex items-center justify-end gap-3 px-4 sm:px-5 py-3 border-t border-border/30">
                                            {completedItems > 0 && (
                                                <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-xs h-7 rounded-lg">
                                                    Clear Completed ({completedItems})
                                                </Button>
                                            )}
                                            {totalItems > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearAll}
                                                    className="text-xs h-7 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" />
                                                    Clear All
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-2xl bg-card shadow-sm border border-border/50 py-16 flex flex-col items-center text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'rgba(10,132,255,0.1)' }}>
                                        <ShoppingCart className="h-7 w-7" style={{ color: '#0A84FF' }} />
                                    </div>
                                    <h3 className="text-[16px] font-semibold mb-1">Your grocery list is empty</h3>
                                    <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                        Add items above or generate a list from your meal plan.
                                    </p>
                                    <Button
                                        className="rounded-full px-7 h-11 text-[14px] font-semibold shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
                                        onClick={() => document.querySelector<HTMLInputElement>('input')?.focus()}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Your First Item
                                    </Button>
                                </div>
                            )}
                        </div>
                        )}

                        <ImageClassificationDialog
                            open={imageDialogOpen}
                            onOpenChange={setImageDialogOpen}
                            onResult={(label) => setNewItem(label)}
                        />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}

export default function GroceryListPage() {
    return (
        <Suspense fallback={
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        <main className="flex-1 p-4 sm:p-6 bg-muted/30 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        }>
            <GroceryListContent />
        </Suspense>
    );
}
