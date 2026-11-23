import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { createPaymentCharge } from "@/lib/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { order_id, method = "qris", bank = "bca", ewallet_channel = "gopay" } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "Nomor ID pesanan wajib disertakan." }, { status: 400 });
    }

    const chargeResult = await createPaymentCharge({
      order_id: Number(order_id),
      method,
      bank,
      ewallet_channel,
      user_id: authUser?.id,
    });

    return NextResponse.json({
      success: true,
      message: "Transaksi pembayaran gateway berhasil diinisialisasi.",
      data: chargeResult,
    });
  } catch (error: unknown) {
    console.error("Payment Charge Error:", error);
    const errMessage = error instanceof Error ? error.message : "Gagal memproses inisialisasi pembayaran gateway.";
    return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
  }
}
