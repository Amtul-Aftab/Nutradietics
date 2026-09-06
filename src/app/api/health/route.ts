import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Runs on the Node.js runtime (Prisma is not supported on the Edge runtime).
export const runtime = "nodejs";
// Always evaluate at request time so the DB check is live.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lightweight round-trip to confirm database connectivity.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "nutradietics",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check database error:", error);
    return NextResponse.json(
      {
        status: "error",
        service: "nutradietics",
        database: "unreachable",
      },
      { status: 503 },
    );
  }
}
