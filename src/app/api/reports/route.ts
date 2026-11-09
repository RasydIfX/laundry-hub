import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month"; // "day" | "month"

    const now = new Date();
    let startDate: Date;

    if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 1. Revenue summary
    const paidOrders = await prisma.order.findMany({
      where: {
        created_at: { gte: startDate },
        status: { not: "cancelled" },
      },
      select: {
        total: true,
        subtotal: true,
        discount_amount: true,
        delivery_fee: true,
        status: true,
      },
    });

    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
    const totalSubtotal = paidOrders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalDiscount = paidOrders.reduce((acc, o) => acc + o.discount_amount, 0);

    // 2. Order counts by status
    const allOrders = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { created_at: { gte: startDate } },
    });

    const statusCounts: Record<string, number> = {};
    allOrders.forEach((g) => {
      statusCounts[g.status] = g._count.id;
    });

    // 3. Top services by usage
    const topServices = await prisma.orderItem.groupBy({
      by: ["service_id"],
      _sum: { quantity: true, subtotal: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const serviceIds = topServices.map((s) => s.service_id);
    const serviceDetails = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      include: { category: true },
    });
    const serviceMap = new Map(serviceDetails.map((s) => [s.id, s]));

    const topServicesData = topServices.map((s) => {
      const svc = serviceMap.get(s.service_id);
      return {
        service_id: s.service_id,
        name: svc?.name || "Unknown",
        category: svc?.category?.name || "Unknown",
        unit: svc?.unit || "-",
        order_count: s._count.id,
        total_quantity: s._sum.quantity || 0,
        total_revenue: s._sum.subtotal || 0,
      };
    });

    // 4. Customer count
    const customerCount = await prisma.user.count({
      where: { role: "customer", created_at: { gte: startDate } },
    });

    const totalCustomers = await prisma.user.count({
      where: { role: "customer" },
    });

    // 5. Average rating
    const avgRating = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    });

    // 6. Pending payments
    const pendingPayments = await prisma.payment.count({
      where: { status: "pending" },
    });

    return NextResponse.json({
      success: true,
      data: {
        period,
        period_start: startDate.toISOString(),
        revenue: {
          total: totalRevenue,
          subtotal: totalSubtotal,
          discount: totalDiscount,
          order_count: paidOrders.length,
        },
        orders_by_status: statusCounts,
        top_services: topServicesData,
        customers: {
          new_this_period: customerCount,
          total: totalCustomers,
        },
        reviews: {
          average_rating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0,
          total_reviews: avgRating._count.id,
        },
        pending_payments: pendingPayments,
      },
    });
  } catch (error) {
    console.error("Reports Error:", error);
    return NextResponse.json({ success: false, error: "Gagal menghasilkan laporan." }, { status: 500 });
  }
}
