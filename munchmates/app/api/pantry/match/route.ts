// POST /api/pantry/match
// Matches recipe ingredients against user's pantry items
// Returns match status (matched/partial/unmatched) for each ingredient

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/normalize";
import { convertToBase, getUnitType, COUNT_MULTIPLIERS, normalizeUnit } from "@/lib/unit-conversion";
import { parseQuantity } from "@/lib/parseQuantity";
import { rateLimiter } from "@/lib/rateLimiter";

interface IngredientInput {
    name: string;
    amount: number;
    unit: string;
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting by IP address
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
            return errorResponse(429, "Too Many Requests");
        }

        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.ingredients || !Array.isArray(body.ingredients)) {
            return errorResponse(400, "Missing required field: ingredients (array)");
        }

        const ingredients: IngredientInput[] = body.ingredients;

        // Fetch all pantry items for user
        const pantryItems = await prisma.pantryItem.findMany({
            where: { userId: p.sub },
        });

        // Build lookup by canonical name
        const pantryByCanon = new Map<string, typeof pantryItems[number]>();
        for (const item of pantryItems) {
            const canon = item.canonName || normalize(item.name);
            pantryByCanon.set(canon, item);
        }

        // Generic words that shouldn't drive a match on their own
        const GENERIC_WORDS = new Set(['sauce', 'oil', 'cream', 'powder', 'fresh', 'dried', 'ground', 'whole', 'raw', 'cooked', 'hot', 'cold', 'red', 'green', 'white', 'black', 'dark', 'light', 'sweet', 'large', 'small', 'medium']);

        // Fuzzy match: check if ingredient words overlap with pantry item name
        function fuzzyFindPantryItem(ingredientCanon: string): typeof pantryItems[number] | undefined {
            const ingredientWords = ingredientCanon.split(/\s+/).filter(w => w.length > 1);

            let bestMatch: typeof pantryItems[number] | undefined;
            let bestScore = 0;

            for (const [canon, item] of pantryByCanon) {
                const pantryWords = canon.split(/\s+/).filter(w => w.length > 1);

                // Check if one name starts with the other (e.g. "garlic" matches
                // "garlic cloves", "olive oil" matches "olive oil extra virgin").
                // Starting-with avoids false positives like "bread" → "bread crumbs"
                // where the pantry item is a modifier, not the core ingredient.
                if (ingredientCanon.startsWith(canon + ' ') || ingredientCanon === canon ||
                    canon.startsWith(ingredientCanon + ' ')) {
                    const score = Math.min(canon.length, ingredientCanon.length) * 10;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = item;
                    }
                    continue;
                }
                // Also match if pantry name appears as the last word(s) — e.g.
                // "extra virgin olive oil" contains "olive oil" at the end
                if (ingredientCanon.endsWith(' ' + canon) || canon.endsWith(' ' + ingredientCanon)) {
                    const score = Math.min(canon.length, ingredientCanon.length) * 8;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = item;
                    }
                    continue;
                }

                // Word overlap: require ALL pantry words to appear in the ingredient,
                // and at least one must be a non-generic word
                const matchedWords = pantryWords.filter(pw => ingredientWords.some(iw => iw === pw));
                if (matchedWords.length === pantryWords.length && pantryWords.length > 0) {
                    const hasSpecificWord = matchedWords.some(w => !GENERIC_WORDS.has(w));
                    if (hasSpecificWord) {
                        const score = matchedWords.length * 10 + canon.length;
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = item;
                        }
                    }
                }
            }

            return bestMatch;
        }

        const matches = ingredients.map((ingredient, index) => {
            const ingredientCanon = normalize(ingredient.name);

            // Try exact match on canonical name, then fuzzy fallback
            const pantryItem = pantryByCanon.get(ingredientCanon) ?? fuzzyFindPantryItem(ingredientCanon);

            if (!pantryItem) {
                return {
                    ingredientIndex: index,
                    ingredientName: ingredient.name,
                    ingredientAmount: ingredient.amount,
                    ingredientUnit: ingredient.unit,
                    pantryItem: null,
                    status: 'unmatched' as const,
                };
            }

            // Get pantry item's structured amount
            let pantryAmount = pantryItem.amount;
            let pantryUnit = pantryItem.unit;
            if (pantryAmount === null) {
                const parsed = parseQuantity(pantryItem.quantity);
                if (parsed) {
                    pantryAmount = parsed.amount;
                    pantryUnit = parsed.unit;
                }
            }

            const pantryItemResponse = {
                id: pantryItem.id,
                name: pantryItem.name,
                amount: pantryAmount,
                unit: pantryUnit,
            };

            // If either side has no amount, consider it a match (can't compare)
            if (pantryAmount === null || !ingredient.amount) {
                return {
                    ingredientIndex: index,
                    ingredientName: ingredient.name,
                    ingredientAmount: ingredient.amount,
                    ingredientUnit: ingredient.unit,
                    pantryItem: pantryItemResponse,
                    status: 'matched' as const,
                };
            }

            // Compare quantities
            const ingredientUnitType = getUnitType(ingredient.unit);
            const pantryUnitType = getUnitType(pantryUnit);

            // If units are compatible, convert to base and compare
            if (ingredientUnitType === pantryUnitType && ingredientUnitType !== 'unknown') {
                if (ingredientUnitType === 'count') {
                    // Normalize through count multipliers (e.g. 1 dozen = 12)
                    const pantryMultiplier = COUNT_MULTIPLIERS[normalizeUnit(pantryUnit)] ?? 1;
                    const ingredientMultiplier = COUNT_MULTIPLIERS[normalizeUnit(ingredient.unit)] ?? 1;
                    const pantryItems = pantryAmount * pantryMultiplier;
                    const ingredientItems = ingredient.amount * ingredientMultiplier;
                    const status = pantryItems >= ingredientItems ? 'matched' : 'partial';
                    return {
                        ingredientIndex: index,
                        ingredientName: ingredient.name,
                        ingredientAmount: ingredient.amount,
                        ingredientUnit: ingredient.unit,
                        pantryItem: pantryItemResponse,
                        status: status as 'matched' | 'partial',
                    };
                }

                const ingredientBase = convertToBase(ingredient.amount, ingredient.unit);
                const pantryBase = convertToBase(pantryAmount, pantryUnit);

                if (ingredientBase && pantryBase) {
                    const status = pantryBase.amount >= ingredientBase.amount ? 'matched' : 'partial';
                    return {
                        ingredientIndex: index,
                        ingredientName: ingredient.name,
                        ingredientAmount: ingredient.amount,
                        ingredientUnit: ingredient.unit,
                        pantryItem: pantryItemResponse,
                        status: status as 'matched' | 'partial',
                    };
                }
            }

            // Units incompatible or unknown — assume matched if pantry has the item
            return {
                ingredientIndex: index,
                ingredientName: ingredient.name,
                ingredientAmount: ingredient.amount,
                ingredientUnit: ingredient.unit,
                pantryItem: pantryItemResponse,
                status: 'matched' as const,
            };
        });

        return NextResponse.json({ ok: true, matches });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/pantry/match:");
    }
}
