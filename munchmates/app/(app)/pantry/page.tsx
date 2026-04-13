// Pantry Page
// Implements the MunchMates pantry management experience with database persistence
// and support for expiry-awareness and image-based item entry.
//
// Features:
// - Auth-gated page wrapped in RequireAuth + SidebarProvider + AppSidebar/AppHeader
//   so it fits the main application shell.
// - Database persistence via /api/pantry — data syncs across devices
// - Add Item form:
//   - Name, quantity, category (via <Select>), optional expiry date
//   - "Add via image" opens ImageClassificationDialog and pre-fills the item name
//   - Enter key support to quickly add items from the keyboard.
// - Inline edit support per item:
//   - Click the pencil icon to edit name, quantity, category, and expiry date
//   - Save/Cancel actions, with Enter/Escape keyboard handling.

'use client';

import { useState, useEffect, useCallback } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search, ShoppingBag, PencilLine, Save, X, Loader2, Camera, Calendar } from 'lucide-react';
import ImageClassificationDialog from '@/components/image-classification-dialog';
import { authedFetch } from '@/lib/authedFetch';
import ApiErrorBanner from '@/components/ui/api-error-banner';
import { assertOk, getErrorMessage, isValidationError } from '@/lib/apiClient';
import { formatAmount } from '@/lib/unit-conversion';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

interface PantryItem {
    id: number;
    name: string;
    quantity: string;
    amount: number | null;
    unit: string;
    category: string;
    expiryDate?: string | null;
    addedAt: string;
}

type RetryAction = () => void | Promise<void>;

const DEFAULT_CATEGORIES = [
    'Produce',
    'Dairy',
    'Meat & Seafood',
    'Pantry',
    'Bakery',
    'Frozen',
    'Spices & Seasonings',
    'Canned Goods',
    'Pasta & Grains',
    'Condiments',
    'Oils & Vinegars',
    'Baking',
    'Beverages',
    'Other',
];

const COMMON_UNITS = ['', 'cups', 'tbsp', 'tsp', 'oz', 'lbs', 'g', 'kg', 'ml', 'L', 'pieces'];

const categoryEmoji: Record<string, string> = {
    'Produce': '🥬',
    'Dairy': '🥛',
    'Meat & Seafood': '🥩',
    'Pantry': '🏠',
    'Bakery': '🍞',
    'Frozen': '🧊',
    'Spices & Seasonings': '🌶️',
    'Canned Goods': '🥫',
    'Pasta & Grains': '🍝',
    'Condiments': '🫙',
    'Oils & Vinegars': '🫒',
    'Baking': '🧁',
    'Beverages': '🥤',
    'Other': '📦',
};

// Map old pantry-only categories into the grocery category set.
const legacyCategoryMap: Record<string, string> = {
    'Grains & Flour': 'Pasta & Grains',
    'Sweeteners': 'Baking',
    'Dairy & Eggs': 'Dairy',
    'Meat & Poultry': 'Meat & Seafood',
    'Meat': 'Meat & Seafood',
    'Seafood': 'Meat & Seafood',
    'Fruits': 'Produce',
    'Vegetables': 'Produce',
    'Herbs & Spices': 'Spices & Seasonings',
    'Herbs': 'Spices & Seasonings',
    'Oils & Vinegar': 'Oils & Vinegars',
    'Baking Supplies': 'Baking',
    'Snacks': 'Other',
};

const normalizeCategory = (cat: string): string => legacyCategoryMap[cat] || cat;

const categoryBorder: Record<string, string> = {
    'Produce': 'border-l-emerald-300',
    'Dairy': 'border-l-blue-300',
    'Meat & Seafood': 'border-l-red-300',
    'Pantry': 'border-l-stone-300',
    'Bakery': 'border-l-amber-300',
    'Frozen': 'border-l-cyan-300',
    'Spices & Seasonings': 'border-l-orange-300',
    'Canned Goods': 'border-l-orange-300',
    'Pasta & Grains': 'border-l-yellow-300',
    'Condiments': 'border-l-purple-300',
    'Oils & Vinegars': 'border-l-lime-300',
    'Baking': 'border-l-fuchsia-300',
    'Beverages': 'border-l-sky-300',
    'Other': 'border-l-gray-300',
};

const categoryColor: Record<string, string> = {
    'Produce': 'bg-green-50 dark:bg-green-950/30',
    'Dairy': 'bg-blue-50 dark:bg-blue-950/30',
    'Meat & Seafood': 'bg-red-50 dark:bg-red-950/30',
    'Pantry': 'bg-stone-50 dark:bg-stone-950/30',
    'Bakery': 'bg-amber-50 dark:bg-amber-950/30',
    'Frozen': 'bg-cyan-50 dark:bg-cyan-950/30',
    'Spices & Seasonings': 'bg-orange-50 dark:bg-orange-950/30',
    'Canned Goods': 'bg-orange-50 dark:bg-orange-950/30',
    'Pasta & Grains': 'bg-yellow-50 dark:bg-yellow-950/30',
    'Condiments': 'bg-purple-50 dark:bg-purple-950/30',
    'Oils & Vinegars': 'bg-lime-50 dark:bg-lime-950/30',
    'Baking': 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
    'Beverages': 'bg-sky-50 dark:bg-sky-950/30',
    'Other': 'bg-gray-50 dark:bg-gray-950/30',
};

function displayQuantity(item: PantryItem): string {
    if (item.amount !== null && item.amount !== undefined) {
        const formatted = formatAmount(item.amount);
        return item.unit ? `${formatted} ${item.unit}` : formatted;
    }
    return item.quantity || '';
}

const Pantry = () => {
    const [items, setItems] = useState<PantryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [apiError, setApiError] = useState<{ message: string; isValidation: boolean; onRetry?: RetryAction } | null>(null);
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

    const [itemName, setItemName] = useState('');
    const [itemAmount, setItemAmount] = useState('');
    const [itemUnit, setItemUnit] = useState('');
    const [itemCategory, setItemCategory] = useState(DEFAULT_CATEGORIES[0]);
    const [expiryDate, setExpiryDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTab, setSelectedTab] = useState('All');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editUnit, setEditUnit] = useState('');
    const [editCategory, setEditCategory] = useState(DEFAULT_CATEGORIES[0]);
    const [editExpiry, setEditExpiry] = useState('');

    const [imageDialogOpen, setImageDialogOpen] = useState(false);

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
            const res = await authedFetch('/api/pantry');
            await assertOk(res, 'Failed to fetch pantry items');
            const data = await res.json();
            setItems((data.items || []).map((item: PantryItem) => ({
                ...item,
                category: normalizeCategory(item.category),
            })));
        } catch (error) {
            setUiError(error, 'Failed to fetch pantry items', fetchItems);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await authedFetch('/api/grocery/categories');
            await assertOk(res, 'Failed to fetch categories');
            const data = await res.json();
            const nextCategories = ((data.categories || []) as Array<{ name: string }>)
                .map((category) => category.name);
            setCategories(nextCategories.length > 0 ? nextCategories : DEFAULT_CATEGORIES);
        } catch (error) {
            setUiError(error, 'Failed to fetch categories', fetchCategories);
        }
    }, []);

    useEffect(() => {
        clearError();
        void fetchItems();
        void fetchCategories();
    }, [fetchItems, fetchCategories]);

    useEffect(() => {
        const fallbackCategory = categories[0] || DEFAULT_CATEGORIES[0];
        if (!categories.includes(itemCategory)) {
            setItemCategory(fallbackCategory);
        }
        if (editingId !== null && !categories.includes(editCategory)) {
            setEditCategory(fallbackCategory);
        }
    }, [categories, itemCategory, editCategory, editingId]);

    const beginEdit = (item: PantryItem) => {
        setEditingId(item.id);
        setEditName(item.name);
        setEditAmount(item.amount !== null && item.amount !== undefined ? String(item.amount) : '');
        setEditUnit(item.unit || '');
        setEditCategory(item.category);
        setEditExpiry(item.expiryDate ?? '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditAmount('');
        setEditUnit('');
        setEditCategory(categories[0] || DEFAULT_CATEGORIES[0]);
        setEditExpiry('');
    };

    const saveEdit = async (id: number) => {
        clearError();
        setIsSaving(true);
        try {
            const amount = editAmount ? parseFloat(editAmount) : null;
            if (amount !== null && isNaN(amount)) {
                setApiError({ message: 'Amount must be a number', isValidation: true });
                setIsSaving(false);
                return;
            }
            const res = await authedFetch('/api/pantry', {
                method: 'PUT',
                body: JSON.stringify({
                    id,
                    name: editName.trim(),
                    amount,
                    unit: editUnit,
                    category: editCategory,
                    expiryDate: editExpiry.trim() || null,
                }),
            });

            await assertOk(res, 'Failed to update pantry item');
            const data = await res.json();
            setItems(prev =>
                prev.map(it => it.id === id ? { ...data.item, category: normalizeCategory(data.item.category) } : it)
            );
            cancelEdit();
        } catch (error) {
            setUiError(error, 'Failed to update pantry item', () => saveEdit(id));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditKey = (e: React.KeyboardEvent, id: number) => {
        if (e.key === 'Enter') saveEdit(id);
        if (e.key === 'Escape') cancelEdit();
    };

    const addItem = async () => {
        if (itemName.trim() === '' || !itemAmount) {
            setApiError({
                message: 'Name and amount are required',
                isValidation: true,
            });
            return;
        }

        clearError();
        setIsSaving(true);
        try {
            const amount = parseFloat(itemAmount);
            if (isNaN(amount)) {
                setApiError({ message: 'Amount must be a number', isValidation: true });
                setIsSaving(false);
                return;
            }

            const res = await authedFetch('/api/pantry', {
                method: 'POST',
                body: JSON.stringify({
                    name: itemName.trim(),
                    amount,
                    unit: itemUnit,
                    category: itemCategory,
                    expiryDate: expiryDate || null,
                }),
            });

            await assertOk(res, 'Failed to add pantry item');
            const data = await res.json();
            setItems(prev => {
                const existingIndex = prev.findIndex(i => i.id === data.item.id);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...data.item, category: normalizeCategory(data.item.category) };
                    return updated;
                }
                return [{ ...data.item, category: normalizeCategory(data.item.category) }, ...prev];
            });
            setItemName('');
            setItemAmount('');
            setItemUnit('');
            setExpiryDate('');
            setItemCategory(categories[0] || DEFAULT_CATEGORIES[0]);
        } catch (error) {
            setUiError(error, 'Failed to add pantry item', addItem);
        } finally {
            setIsSaving(false);
        }
    };

    const removeItem = async (id: number) => {
        clearError();
        try {
            const res = await authedFetch(`/api/pantry?id=${id}`, {
                method: 'DELETE',
            });

            await assertOk(res, 'Failed to delete pantry item');
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            setUiError(error, 'Failed to delete pantry item', () => removeItem(id));
        }
    };

    const clearAll = async () => {
        clearError();
        try {
            const res = await authedFetch('/api/pantry', {
                method: 'DELETE',
            });

            await assertOk(res, 'Failed to clear pantry');
            setItems([]);
            cancelEdit();
        } catch (error) {
            setUiError(error, 'Failed to clear all pantry items', clearAll);
        }
    };


    const getDaysUntilExpiry = (expiryDate: string): number => {
        // Parse both as local dates to avoid UTC offset issues
        const [ey, em, ed] = expiryDate.split('-').map(Number);
        const today = new Date();
        const expiry = new Date(ey, em - 1, ed);
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.round((expiry.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    };

    const getExpiryStatus = (expiryDate?: string | null) => {
        if (!expiryDate) return null;

        const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
        if (daysUntilExpiry < 0) return { label: 'Expired', variant: 'destructive' as const};
        if (daysUntilExpiry === 0) return { label: 'Expires Today', variant: 'destructive' as const};
        if (daysUntilExpiry <= 3) return { label: 'Expiring Soon', variant: 'destructive' as const};
        if (daysUntilExpiry <= 7) return { label: 'This Week', variant: 'secondary' as const};
        return null;
    };

    // Filter by search + tab
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = selectedTab === 'All' || item.category === selectedTab;
        return matchesSearch && matchesTab;
    });

    // Group items by category
    const itemsByCategory = filteredItems.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, PantryItem[]>);

    // Categories that have items (for tabs)
    const populatedCategories = categories.filter(cat =>
        items.some(item => item.category === cat)
    );

    const totalItems = items.length;
    const expiringSoon = items.filter((item) => {
        if (!item.expiryDate) return false;
        const days = getDaysUntilExpiry(item.expiryDate);
        return days <= 7 && days >= 0;
    }).length;

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addItem();
        }
    };

    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        <main className="flex-1 p-4 sm:p-6 bg-amber-50/40">
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
                                            if (apiError.onRetry) {
                                                void apiError.onRetry();
                                                return;
                                            }
                                            void fetchItems();
                                        }}
                                    />
                                )}

                                {/* Header: title + stats + photo button */}
                                <div
                                    className="rounded-2xl px-4 sm:px-6 py-4 shadow-sm border border-amber-200/30"
                                    style={{
                                        background: 'linear-gradient(135deg, hsl(35 70% 45% / 0.25) 0%, hsl(25 60% 40% / 0.15) 50%, hsl(40 55% 50% / 0.08) 100%)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm shadow-sm">
                                                <ShoppingBag className="h-5 w-5 text-amber-700" />
                                            </div>
                                            <div>
                                                <h1 className="text-lg font-bold text-foreground leading-tight">Pantry</h1>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[12px] text-foreground/60">
                                                        <span className="font-bold" style={{ color: '#0A84FF' }}>{totalItems}</span> items
                                                    </span>
                                                    {expiringSoon > 0 && (
                                                        <>
                                                            <span className="text-foreground/20">|</span>
                                                            <span className="text-[12px] text-foreground/60 flex items-center gap-1">
                                                                <Calendar className="h-3 w-3 text-red-500" />
                                                                <span className="font-bold text-red-600">{expiringSoon}</span> expiring
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => setImageDialogOpen(true)}
                                            className="rounded-full h-9 px-5 shadow-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
                                        >
                                            <Camera className="h-4 w-4 mr-1.5" />
                                            Add by Photo
                                        </Button>
                                    </div>
                                </div>

                                {/* Add item form */}
                                <div className="rounded-2xl bg-card shadow-sm border border-border/50 px-4 sm:px-5 py-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative flex-[2] min-w-[120px]">
                                            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                            <Input
                                                placeholder="Add an item..."
                                                value={itemName}
                                                onChange={(e) => setItemName(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                className="h-10 pl-9 rounded-xl text-sm"
                                            />
                                        </div>
                                        <Input
                                            type="number"
                                            placeholder="Quantity"
                                            value={itemAmount}
                                            onChange={(e) => setItemAmount(e.target.value)}
                                            onKeyDown={handleKeyPress}
                                            className="w-28 h-10 rounded-xl text-sm"
                                            min={0}
                                            step="any"
                                        />
                                        <Select value={itemUnit || '__none'} onValueChange={(v) => setItemUnit(v === '__none' ? '' : v)}>
                                            <SelectTrigger className="w-[110px] h-10 rounded-xl text-sm">
                                                <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COMMON_UNITS.map(u => (
                                                    <SelectItem key={u || '__none'} value={u || '__none'}>{u || 'No unit'}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={itemCategory} onValueChange={setItemCategory}>
                                            <SelectTrigger className="w-[150px] h-10 rounded-xl text-sm">
                                                <SelectValue placeholder="Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="date"
                                            value={expiryDate}
                                            onChange={(e) => setExpiryDate(e.target.value)}
                                            onKeyDown={handleKeyPress}
                                            className="w-[140px] h-10 rounded-xl text-sm"
                                        />
                                        <Button
                                            onClick={addItem}
                                            disabled={isSaving}
                                            className="rounded-xl h-10 px-5 shadow-sm"
                                        >
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Search + category filter toolbar */}
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                        <Input
                                            placeholder="Search your pantry..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full h-9 pl-10 rounded-full text-sm bg-card border-border/50 shadow-sm placeholder:text-muted-foreground/40"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 bg-muted/60 rounded-full p-0.5 flex-shrink-0 overflow-x-auto">
                                        {['All', ...populatedCategories].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setSelectedTab(tab)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                                                    selectedTab === tab
                                                        ? 'bg-white shadow-sm text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Item list */}
                                {totalItems > 0 ? (
                                    <div className="rounded-2xl bg-white/80 shadow-sm border border-amber-200/40 overflow-hidden">
                                        {/* Item list */}
                                        {Object.keys(itemsByCategory).length > 0 ? (
                                            selectedTab === 'All' ? (
                                                // Grouped view
                                                <div className="space-y-4 p-3 sm:p-4">
                                                    {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
                                                        <div key={category} className={`rounded-xl overflow-hidden ${categoryColor[category] || 'bg-gray-50 dark:bg-gray-950/30'}`}>
                                                            <div className="flex items-center gap-2.5 px-5 py-3">
                                                                <span className="text-lg">{categoryEmoji[category] || '📦'}</span>
                                                                <span className="text-[15px] font-bold">{category}</span>
                                                                <span className="text-[11px] font-bold text-muted-foreground bg-white/60 dark:bg-white/10 rounded-full px-2 py-0.5 ml-auto">
                                                                    {categoryItems.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4 pb-4 gap-3">
                                                                {categoryItems.map(item => renderItem(item))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                // Flat grid for specific tab
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-4 gap-3">
                                                    {filteredItems.map(item => renderItem(item))}
                                                </div>
                                            )
                                        ) : (
                                            <div className="py-12 text-center">
                                                <p className="text-[14px] font-medium text-muted-foreground">No items found</p>
                                                <p className="text-[12px] text-muted-foreground/70 mt-1">Try adjusting your search or filter</p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-3 px-4 sm:px-5 py-3 border-t border-border/30">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAll}
                                                className="text-xs h-7 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Clear All
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // Empty state
                                    <div className="rounded-2xl bg-white/80 shadow-sm border border-amber-200/40 py-16 flex flex-col items-center text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'rgba(48,209,88,0.1)' }}>
                                            <ShoppingBag className="h-7 w-7" style={{ color: '#30D158' }} />
                                        </div>
                                        <h3 className="text-[16px] font-semibold mb-1">Your pantry is empty</h3>
                                        <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                            Start by adding some ingredients to keep track of what you have.
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
                                onResult={(label) => setItemName(label)}
                            />
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );

    function renderItem(item: PantryItem) {
        const expiryStatus = getExpiryStatus(item.expiryDate);
        const isEditing = editingId === item.id;

        if (isEditing) {
            return (
                <div key={item.id} className="col-span-full rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        <Input
                            autoFocus
                            placeholder="Name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => handleEditKey(e, item.id)}
                            className="h-8 rounded-lg text-sm"
                        />
                        <Input
                            type="number"
                            placeholder="Amount"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            onKeyDown={(e) => handleEditKey(e, item.id)}
                            className="h-8 rounded-lg text-sm"
                            min={0}
                            step="any"
                        />
                        <Select value={editUnit || '__none'} onValueChange={(v) => setEditUnit(v === '__none' ? '' : v)}>
                            <SelectTrigger
                                className="h-8 rounded-lg text-sm bg-background"
                                onKeyDown={(e) => handleEditKey(e, item.id)}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_UNITS.map(u => (
                                    <SelectItem key={u || '__none'} value={u || '__none'}>{u || 'No unit'}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <Input
                            type="date"
                            value={editExpiry}
                            onChange={(e) => setEditExpiry(e.target.value)}
                            onKeyDown={(e) => handleEditKey(e, item.id)}
                            className="h-8 rounded-lg text-sm"
                        />
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
            );
        }

        const isExpiring = expiryStatus?.label === 'Expiring Soon' || expiryStatus?.label === 'Expires Today' || expiryStatus?.label === 'Expired';
        const leftBorder = isExpiring ? 'border-l-red-400' : (categoryBorder[item.category] || 'border-l-gray-300');

        return (
            <div
                key={item.id}
                className={`group relative rounded-xl bg-white dark:bg-white/5 border border-amber-100/60 border-l-[3px] ${leftBorder} px-3 py-2 transition-all hover:shadow-md hover:scale-[1.01]`}
                style={{ boxShadow: '0 1px 4px rgba(180,140,100,0.12)' }}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-0 flex-wrap">
                            <span className="text-[14px] font-semibold leading-tight truncate">{item.name}</span>
                            {(() => { const qty = displayQuantity(item); return qty ? (
                                <>
                                    <span className="mx-1.5 text-muted-foreground/30">·</span>
                                    <span className="text-[12px] text-foreground/60">{qty}</span>
                                </>
                            ) : null; })()}
                        </div>
                        <div className="flex items-center gap-0 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                            <span>Added {new Date(item.addedAt + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            {item.expiryDate && (
                                <>
                                    <span className="mx-1.5 text-muted-foreground/30">·</span>
                                    <span>Exp {new Date(item.expiryDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </>
                            )}
                            {expiryStatus && (
                                <Badge
                                    variant={expiryStatus.variant}
                                    className="text-[10px] px-1.5 py-0 h-4 ml-2"
                                >
                                    {expiryStatus.label}
                                </Badge>
                            )}
                        </div>
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
                            onClick={() => removeItem(item.id)}
                            className="h-6 w-6 rounded hover:bg-red-100 hover:text-red-600"
                            title="Delete"
                        >
                            <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
};

export default Pantry;
