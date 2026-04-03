// app/api/upload/route.ts
// Endpoint to upload recipe images to local filesystem
// Validates file type and size, stores with UUID filename under public/uploads/recipes

import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/verifyToken";
import { handleRouteError, errorResponse } from "@/lib/apiErrors";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { rateLimiter } from "@/lib/rateLimiter";

const ALLOWED_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

export async function POST(req: NextRequest) {
    try {
        // Rate limiting by IP address
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
            return errorResponse(429, "Too Many Requests");
        }
        await verifyBearer(req.headers.get("authorization") || undefined);

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
        }

        const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ ok: false, error: "File too large. Max 5MB." }, { status: 400 });
        }

        const ext = ALLOWED_TYPES[file.type];
        if (!ext) {
            return NextResponse.json(
                { ok: false, error: "Invalid file type. Allowed: jpeg, png, webp, gif" },
                { status: 400 },
            );
        }

        const filename = `${randomUUID()}.${ext}`;
        const dir = path.join(process.cwd(), "public", "uploads", "recipes");
        await mkdir(dir, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(dir, filename), buffer);

        return NextResponse.json({ ok: true, url: `/uploads/recipes/${filename}` });
    } catch (error) {
        return handleRouteError(error, "Error uploading file:");
    }
}
