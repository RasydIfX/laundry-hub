import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { createOrder } from "@/lib/order-engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNo = searchParams.get("order_no");
    const status = searchParams.get("status");
    const outletId = searchParams.get("outlet_id");
    const search = searchParams.get("q");

    // Public / Guest tracking by specific order_no
    if (orderNo) {
      const order = await prisma.order.findUnique({
        where: { order_no: orderNo.trim() },
        include: {
          items: { include: { service: { include: { category: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
          outlet: true,
          promo: true,
          payments: true,
          deliveries: { include: { courier: { select: { id: true, name: true, phone: true } }, address: true } },
          status_logs: {
            include: { user: { select: { id: true, name: true, role: true } } },
            orderBy: { created_at: "asc" },
          },
          review: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: "Pesanan dengan nomor tersebut tidak ditemukan." },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: order });
    }

    // Role-filtered listing
    const authUser = await getAuthUser(req);
    const where: Record<string, unknown> = {};

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Diperlukan autentikasi untuk melihat daftar pesanan." },
        { status: 401 }
      );
    }

    if (authUser.role === "customer") {
      where.customer_id = authUser.id;
    } else if (authUser.role === "kurir") {
      where.deliveries = {
        some: { courier_id: authUser.id },
      };
    }
    // admin and kasir see all orders

    if (status) {
      where.status = status;
    }

    if (outletId) {
      where.outlet_id = parseInt(outletId, 10);
    }

    if (search) {
      where.OR = [
        { order_no: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { service: true } },
        customer: { select: { id: true, name: true, phone: true } },
        outlet: true,
        promo: true,
        payments: true,
        deliveries: { include: { courier: { select: { id: true, name: true, phone: true } } } },
        status_logs: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar pesanan." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authUser = await getAuthUser(req);

    let customerId: number | null = authUser ? authUser.id : null;

    // Support walk-in or guest checkout by phone & name
    if (!customerId) {
      const { guest_name, guest_phone, guest_address } = body;
      if (!guest_name || !guest_phone) {
        return NextResponse.json(
          { success: false, error: "Nama dan nomor WhatsApp pelanggan wajib diisi." },
          { status: 400 }
        );
      }

      // Check or create customer
      let customer = await prisma.user.findUnique({
        where: { phone: guest_phone.trim() },
      });

      if (!customer) {
        customer = await prisma.user.create({
          data: {
            name: guest_name.trim(),
            phone: guest_phone.trim(),
            password_hash: "$2a$10$temporaryGuestPasswordHash123456789",
            role: "customer",
          },
        });

        if (guest_address) {
          await prisma.address.create({
            data: {
              user_id: customer.id,
              label: "Alamat Utama",
              full_address: guest_address.trim(),
              is_default: true,
            },
          });
        }
      }

      customerId = customer.id;
    }

    const {
      outlet_id,
      promo_code,
      order_source = authUser?.role === "kasir" ? "walk_in" : "online",
      fulfillment_type = "drop_off",
      address_id,
      notes,
      items,
      scheduled_at,
    } = body;

    if (!outlet_id) {
      return NextResponse.json(
        { success: false, error: "Pilih workshop / outlet tujuan." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Minimal pilih satu item layanan laundry." },
        { status: 400 }
      );
    }

    let finalAddressId = address_id ? Number(address_id) : undefined;
    if (!finalAddressId && fulfillment_type === "pickup_delivery") {
      if (body.guest_address) {
        const newAddr = await prisma.address.create({
          data: {
            user_id: customerId,
            label: "Alamat Jemput",
            full_address: String(body.guest_address).trim(),
            is_default: true,
          },
        });
        finalAddressId = newAddr.id;
      } else {
        const defaultAddr = await prisma.address.findFirst({
          where: { user_id: customerId },
          orderBy: { is_default: "desc" },
        });
        if (defaultAddr) {
          finalAddressId = defaultAddr.id;
        } else {
          const fallbackAddr = await prisma.address.create({
            data: {
              user_id: customerId,
              label: "Alamat Jemput Pelanggan",
              full_address: "Jl. Teuku Umar, Kedaton, Bandar Lampung",
              is_default: true,
            },
          });
          finalAddressId = fallbackAddr.id;
        }
      }
    }

    const order = await createOrder({
      customer_id: customerId,
      outlet_id: Number(outlet_id),
      promo_code,
      order_source,
      fulfillment_type,
      address_id: finalAddressId,
      notes,
      items: items.map((i: { service_id: number; quantity: number; note?: string }) => ({
        service_id: Number(i.service_id),
        quantity: Number(i.quantity),
        note: i.note,
      })),
      changed_by: authUser?.id || customerId,
      scheduled_at,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pesanan laundry berhasil dibuat.",
        data: order,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Gagal memproses pesanan.";
    console.error("Create Order Error:", error);
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 400 }
    );
  }
}
