// POST /api/pantry/deduct
// Deducts ingredient amounts from pantry items after cooking
// Removes items that reach zero or below

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { convertToBase, getUnitType, COUNT_MULTIPLIERS, normalizeUnit } from "@/lib/unit-conversion";
import { parseQuantity } from "@/lib/parseQuantity";
import { rateLimiter } from "@/lib/rateLimiter";

interface DeductionInput {
    pantryItemId: number;
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

        if (!body.deductions || !Array.isArray(body.deductions)) {
            return errorResponse(400, "Missing required field: deductions (array)");
        }

        const deductions: DeductionInput[] = body.deductions;

        // Validate each deduction has proper types
        for (const d of deductions) {
            if (typeof d.pantryItemId !== 'number' || typeof d.amount !== 'number' || isNaN(d.amount)) {
                return errorResponse(400, "Each deduction must have numeric pantryItemId and amount");
            }
        }

        if (deductions.length === 0) {
            return NextResponse.json({ ok: true, results: [] });
        }

        // Verify all items belong to user
        const itemIds = deductions.map((d) => d.pantryItemId);
        const items = await prisma.pantryItem.findMany({
            where: { id: { in: itemIds }, userId: p.sub },
        });

        const itemMap = new Map(items.map((item) => [item.id, item]));

        // Verify ownership
        for (const deduction of deductions) {
            if (!itemMap.has(deduction.pantryItemId)) {
                return errorResponse(404, `Pantry item ${deduction.pantryItemId} not found`);
            }
        }

        // Process deductions in a transaction
        const results = await prisma.$transaction(async (tx) => {
            const txResults: Array<{
                pantryItemId: number;
                action: 'updated' | 'removed';
                remainingAmount?: number;
                remainingUnit?: string;
            }> = [];

            for (const deduction of deductions) {
                const item = itemMap.get(deduction.pantryItemId)!;

                // Get pantry item's current amount
                let currentAmount = item.amount;
                let currentUnit = item.unit;
                if (currentAmount === null) {
                    const parsed = parseQuantity(item.quantity);
                    if (parsed) {
                        currentAmount = parsed.amount;
                        currentUnit = parsed.unit;
                    }
                }

                // If we can't determine the current amount, skip
                if (currentAmount === null || currentAmount === undefined) {
                    txResults.push({
                        pantryItemId: item.id,
                        action: 'updated',
                        remainingAmount: undefined,
                        remainingUnit: currentUnit,
                    });
                    continue;
                }

                let remainingAmount: number;
                let remainingUnit: string = currentUnit;

                const currentUnitType = getUnitType(currentUnit);
                const deductUnitType = getUnitType(deduction.unit);

                if (currentUnitType === deductUnitType && currentUnitType !== 'unknown') {
                    if (currentUnitType === 'count') {
                        // Normalize both to individual items before subtracting
                        // e.g. 1 dozen (12) - 2 large (2) = 10 items
                        const currentMultiplier = COUNT_MULTIPLIERS[normalizeUnit(currentUnit)] ?? 1;
                        const deductMultiplier = COUNT_MULTIPLIERS[normalizeUnit(deduction.unit)] ?? 1;
                        const currentItems = currentAmount * currentMultiplier;
                        const deductItems = deduction.amount * deductMultiplier;
                        const remainingItems = currentItems - deductItems;
                        // If the original unit was a group (dozen, pair) and the result
                        // doesn't divide evenly, switch to plain count
                        if (currentMultiplier > 1 && remainingItems % currentMultiplier !== 0) {
                            remainingAmount = remainingItems;
                            remainingUnit = '';
                        } else {
                            remainingAmount = remainingItems / currentMultiplier;
                        }
                    } else {
                        // Convert both to base, subtract, convert back to original unit
                        const currentBase = convertToBase(currentAmount, currentUnit);
                        const deductBase = convertToBase(deduction.amount, deduction.unit);

                        if (currentBase && deductBase) {
                            const remainingBase = currentBase.amount - deductBase.amount;
                            // Convert back to the original pantry unit instead of
                            // letting convertFromBase pick a different unit
                            if (currentAmount === 0) {
                                remainingAmount = -deduction.amount;
                            } else {
                                const originalFactor = currentBase.amount / currentAmount;
                                remainingAmount = remainingBase / originalFactor;
                            }
                            // Keep remainingUnit = currentUnit (already set above)
                        } else {
                            remainingAmount = currentAmount - deduction.amount;
                        }
                    }
                } else {
                    // Incompatible units — do direct subtraction as best effort
                    remainingAmount = currentAmount - deduction.amount;
                }

                if (remainingAmount <= 0) {
                    // Remove the item
                    await tx.pantryItem.delete({ where: { id: item.id } });
                    txResults.push({
                        pantryItemId: item.id,
                        action: 'removed',
                    });
                } else {
                    // Update with remaining amount
                    const roundedAmount = Math.round(remainingAmount * 100) / 100;
                    await tx.pantryItem.update({
                        where: { id: item.id },
                        data: {
                            amount: roundedAmount,
                            unit: remainingUnit,
                            quantity: `${roundedAmount} ${remainingUnit}`.trim(),
                        },
                    });
                    txResults.push({
                        pantryItemId: item.id,
                        action: 'updated',
                        remainingAmount: roundedAmount,
                        remainingUnit,
                    });
                }
            }

            return txResults;
        });

        return NextResponse.json({ ok: true, results });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/pantry/deduct:");
    }
}
