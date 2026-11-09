import { NextRequest, NextResponse } from "next/server";
import { calculatePromoDiscount } from "@/lib/order-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, subtotal } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Kode voucher tidak boleh kosong." },
        { status: 400 }
      );
    }

    const result = await calculatePromoDiscount(code, Number(subtotal || 0));

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Voucher promo berhasil diterapkan.",
      data: {
        code: code.trim().toUpperCase(),
        promo_id: result.promoId,
        discount_amount: result.discountAmount,
      },
    });
  } catch (error) {
    console.error("Validate Promo Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memvalidasi promo." },
      { status: 500 }
    );
  }
}
