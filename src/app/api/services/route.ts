import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category_id");
    const unit = searchParams.get("unit");

    const where: Record<string, unknown> = { is_active: true };
    if (categoryId) where.category_id = parseInt(categoryId, 10);
    if (unit) where.unit = unit;

    const services = await prisma.service.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ category_id: "asc" }, { price: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Fetch Services Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar layanan." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Only admin can create service
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { category_id, name, unit, price, est_duration_hours } = body;

    if (!category_id || !name || !unit || price === undefined) {
      return NextResponse.json(
        { success: false, error: "Semua kolom layanan wajib diisi." },
        { status: 400 }
      );
    }

    const service = await prisma.service.create({
      data: {
        category_id: Number(category_id),
        name: name.trim(),
        unit: unit.trim(),
        price: Number(price),
        est_duration_hours: Number(est_duration_hours || 48),
      },
      include: { category: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Layanan baru berhasil ditambahkan.",
        data: service,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Service Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan layanan." },
      { status: 500 }
    );
  }
}
