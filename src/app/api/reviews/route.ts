import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, order_no: true } },
      },
      orderBy: { created_at: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error("Fetch Reviews Error:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat ulasan pelanggan." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["customer"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { order_id, rating, comment } = body;

    if (!order_id || !rating) {
      return NextResponse.json(
        { success: false, error: "ID pesanan dan rating (1-5) wajib diisi." },
        { status: 400 }
      );
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { success: false, error: "Rating harus berupa angka antara 1 sampai 5." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(order_id) },
    });

    if (!order || order.customer_id !== user!.id) {
      return NextResponse.json(
        { success: false, error: "Pesanan tidak valid atau bukan milik akun Anda." },
        { status: 403 }
      );
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "Ulasan hanya dapat diberikan setelah pesanan berstatus Selesai." },
        { status: 400 }
      );
    }

    // Check if review already exists
    const existing = await prisma.review.findUnique({
      where: { order_id: Number(order_id) },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Anda sudah memberikan ulasan untuk pesanan ini." },
        { status: 409 }
      );
    }

    const review = await prisma.review.create({
      data: {
        order_id: Number(order_id),
        customer_id: user!.id,
        rating: ratingNum,
        comment: comment ? comment.trim() : null,
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Terima kasih! Ulasan Anda telah berhasil disimpan.",
        data: review,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Review Error:", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan ulasan." }, { status: 500 });
  }
}
