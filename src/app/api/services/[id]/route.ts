import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const serviceId = parseInt(id, 10);
  if (isNaN(serviceId)) {
    return NextResponse.json({ success: false, error: "ID Layanan tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, price, est_duration_hours, is_active, category_id } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (price !== undefined) data.price = Number(price);
    if (est_duration_hours !== undefined) data.est_duration_hours = Number(est_duration_hours);
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (category_id !== undefined) data.category_id = Number(category_id);

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data,
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      message: "Data layanan berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui layanan." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const serviceId = parseInt(id, 10);
  if (isNaN(serviceId)) {
    return NextResponse.json({ success: false, error: "ID Layanan tidak valid." }, { status: 400 });
  }

  try {
    // Soft delete (set is_active to false) to maintain transaction snapshot integrity
    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: { is_active: false },
    });

    return NextResponse.json({
      success: true,
      message: "Layanan berhasil dinonaktifkan.",
      data: updated,
    });
  } catch (error) {
    console.error("Delete Service Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menonaktifkan layanan." },
      { status: 500 }
    );
  }
}
