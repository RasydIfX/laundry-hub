import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { transitionOrderStatus } from "@/lib/order-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parseInt(id, 10);

  if (isNaN(orderId)) {
    return NextResponse.json({ success: false, error: "ID pesanan tidak valid." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { service: { include: { category: true } } } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        outlet: true,
        promo: true,
        payments: { orderBy: { created_at: "desc" } },
        deliveries: {
          include: {
            courier: { select: { id: true, name: true, phone: true } },
            address: true,
          },
        },
        status_logs: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { created_at: "asc" },
        },
        review: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("Fetch Order Detail Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil data pesanan." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin", "kasir", "kurir"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ success: false, error: "ID pesanan tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { status, note } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: "Status baru harus dicantumkan." }, { status: 400 });
    }

    const updated = await transitionOrderStatus({
      orderId,
      newStatus: status,
      changedByUserId: user!.id,
      note,
    });

    return NextResponse.json({
      success: true,
      message: `Status pesanan berhasil diperbarui menjadi ${status}.`,
      data: updated,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Gagal memperbarui status pesanan.";
    console.error("Update Order Status Error:", error);
    return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
  }
}
