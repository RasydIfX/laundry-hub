import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { is_active: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: outlets,
    });
  } catch (error) {
    console.error("Fetch Outlets Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data outlet." },
      { status: 500 }
    );
  }
}
