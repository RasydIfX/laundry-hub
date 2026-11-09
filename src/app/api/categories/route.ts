import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.serviceCategory.findMany({
      include: {
        services: {
          where: { is_active: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Fetch Categories Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data kategori." },
      { status: 500 }
    );
  }
}
