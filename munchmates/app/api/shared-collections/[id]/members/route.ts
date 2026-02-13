// shared-collections/[id]/members/route.ts
// Endpoints to manage members within a collection
// This focuses on managing the lists of users within a collection and their permissions
// Validates member role (owner or editor) before performing actions
// Requires authenticated user
//   POST: adds a new member
//   DELETE: removes a member
//   PUT: updates a member's role within the collection
// Backed by Postgres via Prisma — data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { formatCollection } from "@/lib/formatCollection";

type RouteContext = {
    params: Promise<{ id: string }>;
};

// POST - Add a member to the collection
export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const { id: collectionId } = await context.params;

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        // Check if user is owner or editor
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role === 'viewer') {
            return errorResponse(403, "You don't have permission to add members");
        }

        const body = await req.json();
        const { memberId, memberName, role = 'viewer' } = body;

        if (!memberId || !memberName) {
            return errorResponse(400, "memberId and memberName are required");
        }

        if (!['editor', 'viewer'].includes(role)) {
            return errorResponse(400, "Role must be 'editor' or 'viewer'");
        }

        // Check if member already exists
        const existingMember = collection.members.find(m => m.userId === memberId);
        if (existingMember) {
            return NextResponse.json(
                { message: "User is already a member of this collection" },
                { status: 200 }
            );
        }

        // Ensure the new member's User record exists
        await prisma.user.upsert({
            where: { id: memberId },
            update: {},
            create: { id: memberId },
        });

        await prisma.collectionMember.create({
            data: {
                collectionId,
                userId: memberId,
                userName: memberName,
                role,
            },
        });

        const updated = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true, recipes: true },
        });

        return NextResponse.json({
            ok: true,
            message: "Member added successfully",
            collection: formatCollection(updated!),
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/shared-collections/[id]/members:");
    }
}

// DELETE - Remove a member from the collection
export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const { id: collectionId } = await context.params;

        const memberId = req.nextUrl.searchParams.get("memberId");

        if (!memberId) {
            return errorResponse(400, "memberId parameter is required");
        }

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        // Check if user is owner
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role !== 'owner') {
            return errorResponse(403, "Only the owner can remove members");
        }

        const targetMember = collection.members.find(m => m.userId === memberId);
        if (!targetMember) {
            return errorResponse(404, "Member not found in collection");
        }

        if (targetMember.role === 'owner') {
            return errorResponse(400, "Cannot remove the owner from the collection");
        }

        await prisma.collectionMember.delete({
            where: { collectionId_userId: { collectionId, userId: memberId } },
        });

        const updated = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true, recipes: true },
        });

        return NextResponse.json({
            ok: true,
            message: "Member removed successfully",
            collection: formatCollection(updated!),
        });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/shared-collections/[id]/members:");
    }
}

// PUT - Update a member's role
export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const { id: collectionId } = await context.params;

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        // Check if user is owner
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role !== 'owner') {
            return errorResponse(403, "Only the owner can change member roles");
        }

        const body = await req.json();
        const { memberId, role } = body;

        if (!memberId || !role) {
            return errorResponse(400, "memberId and role are required");
        }

        if (!['editor', 'viewer'].includes(role)) {
            return errorResponse(400, "Role must be 'editor' or 'viewer'");
        }

        const targetMember = collection.members.find(m => m.userId === memberId);
        if (!targetMember) {
            return errorResponse(404, "Member not found in collection");
        }

        if (targetMember.role === 'owner') {
            return errorResponse(400, "Cannot change the owner's role");
        }

        await prisma.collectionMember.update({
            where: { collectionId_userId: { collectionId, userId: memberId } },
            data: { role },
        });

        const updated = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true, recipes: true },
        });

        return NextResponse.json({
            ok: true,
            message: "Member role updated successfully",
            collection: formatCollection(updated!),
        });
    } catch (error) {
        return handleRouteError(error, "Error in PUT /api/shared-collections/[id]/members:");
    }
}
