// app/api/docs/route.ts
// Serves the generated OpenAPI JSON spec at /api/docs

import { NextResponse } from "next/server";
import { getApiDocs } from "@/lib/swagger";

export async function GET() {
    const spec = await getApiDocs();
    return NextResponse.json(spec);
}