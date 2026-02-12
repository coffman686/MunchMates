// lib/formatCollection.ts
// Converts Prisma SharedCollection (with relations) to the frontend-compatible shape
// Used by all shared-collections API routes for consistent response formatting

import type { SharedCollection, CollectionMember, CollectionRecipe } from '@prisma/client'

type CollectionWithRelations = SharedCollection & {
    members: CollectionMember[];
    recipes: CollectionRecipe[];
};

export function formatCollection(c: CollectionWithRelations) {
    return {
        id: c.id,
        name: c.name,
        description: c.description,
        createdBy: c.createdBy,
        createdByName: c.createdByName,
        createdAt: c.createdAt.toISOString(),
        members: c.members.map((m) => ({
            userId: m.userId,
            userName: m.userName,
            role: m.role,
            joinedAt: m.joinedAt.toISOString(),
        })),
        recipes: c.recipes.map((r) => ({
            recipeId: r.recipeId,
            recipeName: r.recipeName,
            addedBy: r.addedBy,
            addedByName: r.addedByName,
            addedAt: r.addedAt.toISOString(),
        })),
    };
}
