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
            return NextResponse.json(
                { error: "Collection not found" },
                { status: 404 }
            );
        }

        // Check if user is owner or editor
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role === 'viewer') {
            return NextResponse.json(
                { error: "You don't have permission to add members" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { memberId, memberName, role = 'viewer' } = body;

        if (!memberId || !memberName) {
            return NextResponse.json(
                { error: "memberId and memberName are required" },
                { status: 400 }
            );
        }

        if (!['editor', 'viewer'].includes(role)) {
            return NextResponse.json(
                { error: "Role must be 'editor' or 'viewer'" },
                { status: 400 }
            );
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in POST /api/shared-collections/[id]/members:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
            return NextResponse.json(
                { error: "memberId parameter is required" },
                { status: 400 }
            );
        }

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return NextResponse.json(
                { error: "Collection not found" },
                { status: 404 }
            );
        }

        // Check if user is owner
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role !== 'owner') {
            return NextResponse.json(
                { error: "Only the owner can remove members" },
                { status: 403 }
            );
        }

        const targetMember = collection.members.find(m => m.userId === memberId);
        if (!targetMember) {
            return NextResponse.json(
                { error: "Member not found in collection" },
                { status: 404 }
            );
        }

        if (targetMember.role === 'owner') {
            return NextResponse.json(
                { error: "Cannot remove the owner from the collection" },
                { status: 400 }
            );
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in DELETE /api/shared-collections/[id]/members:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
            return NextResponse.json(
                { error: "Collection not found" },
                { status: 404 }
            );
        }

        // Check if user is owner
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role !== 'owner') {
            return NextResponse.json(
                { error: "Only the owner can change member roles" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { memberId, role } = body;

        if (!memberId || !role) {
            return NextResponse.json(
                { error: "memberId and role are required" },
                { status: 400 }
            );
        }

        if (!['editor', 'viewer'].includes(role)) {
            return NextResponse.json(
                { error: "Role must be 'editor' or 'viewer'" },
                { status: 400 }
            );
        }

        const targetMember = collection.members.find(m => m.userId === memberId);
        if (!targetMember) {
            return NextResponse.json(
                { error: "Member not found in collection" },
                { status: 404 }
            );
        }

        if (targetMember.role === 'owner') {
            return NextResponse.json(
                { error: "Cannot change the owner's role" },
                { status: 400 }
            );
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in PUT /api/shared-collections/[id]/members:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
