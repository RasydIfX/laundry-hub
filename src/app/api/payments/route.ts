import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { order_id, method, amount, proof_url, gateway_ref } = body;

    if (!order_id || !method || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "Order ID, metode pembayaran, dan nominal wajib diisi." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(order_id) },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    // Cash paid at POS kasir is instantly marked as "paid"
    const isInstantPaid = method === "cash" && (authUser?.role === "kasir" || authUser?.role === "admin");
    const paymentStatus = isInstantPaid ? "paid" : "pending";

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          order_id: Number(order_id),
          method,
          amount: Number(amount),
          status: paymentStatus,
          proof_url: proof_url || null,
          gateway_ref: gateway_ref || (method === "qris" ? `QRIS-${Date.now()}` : null),
          paid_at: isInstantPaid ? new Date() : null,
        },
      });

      if (isInstantPaid) {
        await tx.orderStatusLog.create({
          data: {
            order_id: Number(order_id),
            status: order.status,
            changed_by: authUser!.id,
            note: `Pembayaran tunai kasir diterima sebesar Rp ${Number(amount).toLocaleString("id-ID")}. Lunas.`,
          },
        });
      }

      return p;
    });

    return NextResponse.json(
      {
        success: true,
        message: isInstantPaid ? "Pembayaran tunai lunas." : "Data pembayaran berhasil dicatat.",
        data: payment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Payment Error:", error);
    return NextResponse.json({ success: false, error: "Gagal memproses pembayaran." }, { status: 500 });
  }
}
