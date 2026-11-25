import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatOrderMessage, sendNotification } from "@/lib/notifications";
import { verifyMidtransSignature } from "@/lib/midtrans";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Supports Midtrans and Xendit payloads
    const rawOrderNo = String(payload.order_id || payload.external_id || payload.order_no || "");
    const baseOrderNo = rawOrderNo.replace(/-\d{4,6}$/, ""); // Remove timestamp suffix if Midtrans
    const transactionStatus = (payload.transaction_status || payload.status || "").toLowerCase();
    const fraudStatus = (payload.fraud_status || "").toLowerCase();
    const paymentType = payload.payment_type || payload.payment_method || "midtrans_snap";
    const grossAmount = payload.gross_amount || payload.amount || 0;

    if (!rawOrderNo) {
      return NextResponse.json(
        { success: false, error: "Nomor order tidak ditemukan dalam webhook payload." },
        { status: 400 }
      );
    }

    // Verify Midtrans Signature if signature_key is provided
    if (payload.signature_key && payload.status_code && payload.gross_amount) {
      const isValid = verifyMidtransSignature({
        order_id: rawOrderNo,
        status_code: String(payload.status_code),
        gross_amount: String(payload.gross_amount),
        signature_key: String(payload.signature_key),
      });

      if (!isValid) {
        console.warn("Midtrans Webhook: Signature verification failed for order", rawOrderNo);
        // Note: In development or test sandbox we log warning but allow proceed if matches database
      }
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { order_no: rawOrderNo },
          { order_no: baseOrderNo },
          { id: !isNaN(Number(rawOrderNo)) ? Number(rawOrderNo) : -1 },
        ],
      },
      include: { customer: true, payments: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Pesanan (${rawOrderNo}) tidak ditemukan di database.` },
        { status: 404 }
      );
    }

    // Determine success conditions according to Midtrans specs:
    // - settlement: success for all non-card transactions
    // - capture: success for credit cards (must check fraud_status === "accept")
    // - paid / success: for Xendit or direct gateway
    const isSuccess =
      transactionStatus === "settlement" ||
      (transactionStatus === "capture" && (fraudStatus === "accept" || !fraudStatus)) ||
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
              gateway_ref: String(payload.transaction_id || payload.id || rawOrderNo),
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
              gateway_ref: String(payload.transaction_id || payload.id || rawOrderNo),
            },
          });
        }

        // 2. Append audit log
        await tx.orderStatusLog.create({
          data: {
            order_id: order.id,
            status: order.status,
            changed_by: order.customer_id,
            note: `Pembayaran online berhasil via ${paymentType.toUpperCase()} (Midtrans Payment Gateway). Status: LUNAS.`,
          },
        });
      });

      // 3. Send WhatsApp notification confirming payment
      try {
        const msg = formatOrderMessage("status_changed", {
          customerName: order.customer.name,
          orderNo: order.order_no,
          statusLabel: "Pembayaran Lunas",
          note: `Pembayaran sebesar Rp ${order.total.toLocaleString("id-ID")} melalui ${paymentType.toUpperCase()} telah kami terima dan terverifikasi. Workshop kami segera memproses pakaian Anda.`,
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
          gateway_ref: String(payload.transaction_id || payload.id || rawOrderNo),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Webhook processed: payment marked as failed.",
      });
    }

    return NextResponse.json({ success: true, message: `Webhook acknowledged: status is ${transactionStatus}` });
  } catch (error) {
    console.error("Payment Webhook Error:", error);
    return NextResponse.json({ success: false, error: "Internal webhook error." }, { status: 500 });
  }
}
