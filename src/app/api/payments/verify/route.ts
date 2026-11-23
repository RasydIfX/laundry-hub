import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { verifyPayment } from "@/lib/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { order_id, payment_id } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "Nomor ID pesanan wajib disertakan." }, { status: 400 });
    }

    const result = await verifyPayment(Number(order_id), payment_id ? Number(payment_id) : undefined, authUser?.id);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Payment Verify Error:", error);
    const errMessage = error instanceof Error ? error.message : "Gagal memverifikasi pembayaran.";
    return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
  }
}
