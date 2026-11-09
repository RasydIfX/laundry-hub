import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const addresses = await prisma.address.findMany({
      where: { user_id: user!.id },
      orderBy: [{ is_default: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Fetch Addresses Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar alamat." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { label, full_address, latitude, longitude, is_default } = body;

    if (!label || !full_address) {
      return NextResponse.json(
        { success: false, error: "Label (misal: Rumah/Kos) dan alamat lengkap wajib diisi." },
        { status: 400 }
      );
    }

    // If marked default, unset existing default
    if (is_default) {
      await prisma.address.updateMany({
        where: { user_id: user!.id, is_default: true },
        data: { is_default: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        user_id: user!.id,
        label: label.trim(),
        full_address: full_address.trim(),
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        is_default: Boolean(is_default),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Alamat berhasil ditambahkan.",
        data: newAddress,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Address Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan alamat baru." },
      { status: 500 }
    );
  }
}
