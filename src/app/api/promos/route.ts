import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const now = new Date();
    const promos = await prisma.promo.findMany({
      where: {
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
      orderBy: { discount_value: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: promos,
    });
  } catch (error) {
    console.error("Fetch Promos Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar voucher promo." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { code, discount_type, discount_value, min_order, start_date, end_date, quota } = body;

    if (!code || !discount_type || discount_value === undefined || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: "Kolom kode, tipe diskon, nilai diskon, dan rentang tanggal wajib diisi." },
        { status: 400 }
      );
    }

    const promo = await prisma.promo.create({
      data: {
        code: code.trim().toUpperCase(),
        discount_type,
        discount_value: Number(discount_value),
        min_order: Number(min_order || 0),
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        quota: Number(quota || 100),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Kode voucher promo berhasil dibuat.",
        data: promo,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Promo Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat voucher promo. Pastikan kode belum pernah dipakai." },
      { status: 500 }
    );
  }
}
