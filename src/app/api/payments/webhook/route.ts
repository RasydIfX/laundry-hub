import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatOrderMessage, sendNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Supports standard Midtrans / Xendit notification payload
    const orderNo = payload.order_id || payload.external_id || payload.order_no;
    const transactionStatus = (payload.transaction_status || payload.status || "").toLowerCase();
    const paymentType = payload.payment_type || payload.payment_method || "midtrans_gateway";
    const grossAmount = payload.gross_amount || payload.amount || 0;

    if (!orderNo) {
      return NextResponse.json({ success: false, error: "Nomor order tidak ditemukan dalam webhook payload." }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { order_no: String(orderNo) },
          { id: !isNaN(Number(orderNo)) ? Number(orderNo) : -1 },
        ],
      },
      include: { customer: true, payments: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan di database." }, { status: 404 });
    }

    // Determine success conditions
    const isSuccess =
      transactionStatus === "settlement" ||
      transactionStatus === "capture" ||
      transactionStatus === "paid" ||
      transactionStatus === "success";

    const isFailure =
      transactionStatus === "expire" ||
      transactionStatus === "cancel" ||
      transactionStatus === "deny";

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        // 1. Create or update payment record
        const existingPayment = order.payments.find((p) => p.status === "pending");
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: "paid",
              method: paymentType,
              paid_at: new Date(),
              gateway_ref: String(payload.transaction_id || payload.id || `GW-${Date.now()}`),
            },
          });
        } else {
          await tx.payment.create({
            data: {
              order_id: order.id,
              method: paymentType,
              amount: Number(grossAmount) || order.total,
              status: "paid",
              paid_at: new Date(),
              gateway_ref: String(payload.transaction_id || payload.id || `GW-${Date.now()}`),
            },
          });
        }

        // 2. Append audit log
        await tx.orderStatusLog.create({
          data: {
            order_id: order.id,
            status: order.status,
            changed_by: order.customer_id,
            note: `Pembayaran online berhasil via ${paymentType} (Midtrans/Gateway). Status: LUNAS.`,
          },
        });
      });

      // 3. Send WhatsApp notification confirming payment
      try {
        const msg = formatOrderMessage("status_changed", {
          customerName: order.customer.name,
          orderNo: order.order_no,
          statusLabel: "Pembayaran Lunas",
          note: `Pembayaran sebesar Rp ${order.total.toLocaleString("id-ID")} telah kami verifikasi. Workshop kami segera memproses pakaian Anda.`,
          trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`,
        });

        await sendNotification({
          userId: order.customer_id,
          orderId: order.id,
          channel: "whatsapp",
          message: msg,
        });
      } catch (notifErr) {
        console.error("Webhook notification error:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: "Webhook processed: payment marked as settled.",
      });
    }

    if (isFailure) {
      await prisma.payment.create({
        data: {
          order_id: order.id,
          method: paymentType,
          amount: Number(grossAmount) || order.total,
          status: "failed",
          gateway_ref: String(payload.transaction_id || payload.id || `GW-${Date.now()}`),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Webhook processed: payment marked as failed.",
      });
    }

    return NextResponse.json({ success: true, message: "Webhook acknowledged." });
  } catch (error) {
    console.error("Payment Webhook Error:", error);
    return NextResponse.json({ success: false, error: "Internal webhook error." }, { status: 500 });
  }
}
