import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createMidtransSnapTransaction,
  isMidtransConfigured,
  getMidtransClientKey,
} from "@/lib/midtrans";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "Parameter order_id wajib disertakan." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(order_id) },
      include: {
        customer: true,
        items: { include: { service: true } },
        payments: { orderBy: { created_at: "desc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Pesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    // Check if already paid
    const isPaid = order.payments.some((p) => p.status === "paid");
    if (isPaid) {
      return NextResponse.json(
        { success: false, error: "Pesanan ini sudah LUNAS." },
        { status: 400 }
      );
    }

    // Check if user is allowed to pay (customer themselves, kasir, or admin)
    if (authUser && authUser.role === "customer" && order.customer_id !== authUser.id) {
      return NextResponse.json(
        { success: false, error: "Anda tidak memiliki akses ke pesanan ini." },
        { status: 403 }
      );
    }

    // Check if Midtrans keys are set in environment
    if (!isMidtransConfigured()) {
      return NextResponse.json({
        success: false,
        error: "MIDTRANS_NOT_CONFIGURED",
        message:
          "Midtrans Server Key belum diatur di file .env. Anda dapat menggunakan mode Simulator Internal atau memasukkan MIDTRANS_SERVER_KEY.",
      });
    }

    const items = order.items.map((i) => ({
      id: `SRV-${i.service_id}`,
      name: i.service.name,
      price: i.unit_price,
      quantity: Math.max(1, Math.round(i.quantity)),
    }));

    const snapResult = await createMidtransSnapTransaction({
      orderId: order.id,
      orderNo: order.order_no,
      total: order.total,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email || undefined,
      },
      items,
    });

    // Record pending payment entry if not exists
    const existingPending = order.payments.find((p) => p.status === "pending");
    if (!existingPending) {
      await prisma.payment.create({
        data: {
          order_id: order.id,
          method: "midtrans_snap",
          amount: order.total,
          status: "pending",
          gateway_ref: snapResult.token,
        },
      });
    } else {
      await prisma.payment.update({
        where: { id: existingPending.id },
        data: {
          gateway_ref: snapResult.token,
          method: "midtrans_snap",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        token: snapResult.token,
        redirect_url: snapResult.redirect_url,
        client_key: getMidtransClientKey(),
        is_sandbox: snapResult.is_sandbox,
        order_no: order.order_no,
        total: order.total,
      },
    });
  } catch (error: unknown) {
    console.error("Snap Token Creation Error:", error);
    const msg = error instanceof Error ? error.message : "Gagal membuat transaksi Midtrans Snap.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
