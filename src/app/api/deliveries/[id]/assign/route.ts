import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin", "kasir"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const deliveryId = parseInt(id, 10);
  if (isNaN(deliveryId)) {
    return NextResponse.json({ success: false, error: "ID tugas delivery tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { courier_id } = body;

    if (!courier_id) {
      return NextResponse.json({ success: false, error: "Pilih kurir yang ditugaskan." }, { status: 400 });
    }

    const courier = await prisma.user.findFirst({
      where: { id: Number(courier_id), role: "kurir", is_active: true },
    });

    if (!courier) {
      return NextResponse.json({ success: false, error: "Kurir tidak ditemukan atau tidak aktif." }, { status: 404 });
    }

    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: { courier_id: courier.id },
      include: {
        courier: { select: { id: true, name: true, phone: true } },
        order: true,
      },
    });

    // Record audit log on order
    await prisma.orderStatusLog.create({
      data: {
        order_id: updated.order_id,
        status: updated.order.status,
        changed_by: user!.id,
        note: `Kurir ${courier.name} ditugaskan untuk ${updated.type === "pickup" ? "penjemputan" : "pengantaran"}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Tugas berhasil dialokasikan ke kurir ${courier.name}.`,
      data: updated,
    });
  } catch (error) {
    console.error("Assign Courier Error:", error);
    return NextResponse.json({ success: false, error: "Gagal menugaskan kurir." }, { status: 500 });
  }
}
