import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { transitionOrderStatus } from "@/lib/order-engine";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["kurir", "admin", "kasir"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const deliveryId = parseInt(id, 10);
  if (isNaN(deliveryId)) {
    return NextResponse.json({ success: false, error: "ID tugas delivery tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { status, note } = body; // "scheduled" | "on_the_way" | "done" | "failed"

    if (!status) {
      return NextResponse.json({ success: false, error: "Status baru harus diisi." }, { status: 400 });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });

    if (!delivery) {
      return NextResponse.json({ success: false, error: "Tugas delivery tidak ditemukan." }, { status: 404 });
    }

    // Check courier authorization (kurir hanya ditolak jika tugas sudah diambil kurir lain)
    if (user!.role === "kurir" && delivery.courier_id && delivery.courier_id !== user!.id) {
      return NextResponse.json(
        { success: false, error: "Tugas ini telah diambil oleh kurir lain." },
        { status: 403 }
      );
    }

    // Jika kurir melakukan aksi klaim saja
    if (status === "claim") {
      const claimed = await prisma.delivery.update({
        where: { id: deliveryId },
        data: { courier_id: user!.id },
        include: { order: true },
      });
      return NextResponse.json({
        success: true,
        message: "Tugas berhasil Anda ambil.",
        data: claimed,
      });
    }

    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...(delivery.courier_id === null && user!.role === "kurir" ? { courier_id: user!.id } : {}),
      },
      include: { order: true },
    });

    // Automatically transition parent order status based on courier progress
    if (delivery.type === "pickup") {
      if (status === "on_the_way") {
        await transitionOrderStatus({
          orderId: delivery.order_id,
          newStatus: "picked_up",
          changedByUserId: user!.id,
          note: `Kurir sedang menuju ke lokasi penjemputan. ${note || ""}`,
        });
      } else if (status === "done") {
        await transitionOrderStatus({
          orderId: delivery.order_id,
          newStatus: "received",
          changedByUserId: user!.id,
          note: `Pakaian berhasil dijemput dan tiba di workshop outlet. ${note || ""}`,
        });
      }
    } else if (delivery.type === "delivery") {
      if (status === "on_the_way") {
        await transitionOrderStatus({
          orderId: delivery.order_id,
          newStatus: "delivering",
          changedByUserId: user!.id,
          note: `Kurir sedang mengantar cucian bersih ke alamat tujuan. ${note || ""}`,
        });
      } else if (status === "done") {
        await transitionOrderStatus({
          orderId: delivery.order_id,
          newStatus: "completed",
          changedByUserId: user!.id,
          note: `Pakaian bersih telah diterima pelanggan. Pesanan selesai. ${note || ""}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Status delivery berhasil diubah menjadi ${status}.`,
      data: updated,
    });
  } catch (error) {
    console.error("Update Delivery Status Error:", error);
    return NextResponse.json({ success: false, error: "Gagal memperbarui status delivery." }, { status: 500 });
  }
}
