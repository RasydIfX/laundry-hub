import { NextRequest, NextResponse } from "next/server";
import { runDatabaseSeed } from "@/lib/seed-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const result = await runDatabaseSeed(force);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Seed API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menginisialisasi database." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
