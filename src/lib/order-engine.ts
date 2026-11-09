import { prisma } from "./prisma";
import { formatOrderMessage, sendNotification } from "./notifications";

export interface CreateOrderItemInput {
  service_id: number;
  quantity: number;
  note?: string;
}

export interface CreateOrderParams {
  customer_id: number;
  outlet_id: number;
  promo_code?: string;
  order_source?: "online" | "walk_in";
  fulfillment_type?: "drop_off" | "pickup_delivery";
  address_id?: number;
  notes?: string;
  items: CreateOrderItemInput[];
  changed_by?: number;
  scheduled_at?: Date | string;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  picked_up: "Pakaian Dijemput Kurir",
  received: "Diterima di Workshop",
  washing: "Sedang Dicuci Higienis",
  ironing: "Proses Setrika & Finishing",
  ready: "Siap Dikirim / Diambil",
  delivering: "Sedang Diantar Kurir",
  completed: "Pesanan Selesai",
  cancelled: "Dibatalkan",
};

/**
 * Generate unique Order Number: LDR-YYYYMMDD-XXXX
 */
export function generateOrderNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `LDR-${dateStr}-${randomSuffix}`;
}

/**
 * Validates promo voucher and calculates applicable discount
 */
export async function calculatePromoDiscount(
  promoCode: string | undefined,
  subtotal: number
): Promise<{ promoId: number | null; discountAmount: number; error?: string }> {
  if (!promoCode) return { promoId: null, discountAmount: 0 };

  const promo = await prisma.promo.findUnique({
    where: { code: promoCode.trim().toUpperCase() },
  });

  if (!promo) {
    return { promoId: null, discountAmount: 0, error: "Kode voucher tidak ditemukan." };
  }

  if (!promo.is_active) {
    return { promoId: null, discountAmount: 0, error: "Kode voucher sudah tidak aktif." };
  }

  const now = new Date();
  if (now < promo.start_date || now > promo.end_date) {
    return { promoId: null, discountAmount: 0, error: "Voucher berada di luar periode masa berlaku." };
  }

  if (promo.quota > 0 && promo.used_count >= promo.quota) {
    return { promoId: null, discountAmount: 0, error: "Kuota penggunaan voucher telah habis." };
  }

  if (subtotal < promo.min_order) {
    return {
      promoId: null,
      discountAmount: 0,
      error: `Minimal transaksi untuk voucher ini adalah Rp ${promo.min_order.toLocaleString("id-ID")}.`,
    };
  }

  let discount = 0;
  if (promo.discount_type === "percent") {
    discount = Math.round((subtotal * promo.discount_value) / 100);
  } else {
    discount = promo.discount_value;
  }

  // Discount cannot exceed subtotal
  discount = Math.min(discount, subtotal);

  return { promoId: promo.id, discountAmount: discount };
}

/**
 * Calculate delivery fee based on fulfillment and order value
 */
export function calculateDeliveryFee(fulfillmentType: string, subtotal: number): number {
  if (fulfillmentType !== "pickup_delivery") return 0;
  // Free delivery for orders >= 50.000 in Bandar Lampung
  if (subtotal >= 50000) return 0;
  return 10000;
}

/**
 * Core Order Creation Engine
 */
export async function createOrder(params: CreateOrderParams) {
  const {
    customer_id,
    outlet_id,
    promo_code,
    order_source = "online",
    fulfillment_type = "drop_off",
    address_id,
    notes,
    items,
    changed_by,
    scheduled_at,
  } = params;

  if (!items || items.length === 0) {
    throw new Error("Pesanan harus memiliki minimal satu item layanan.");
  }

  // 1. Fetch active service prices to ensure accurate snapshot
  const serviceIds = items.map((i) => i.service_id);
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, is_active: true },
    include: { category: true },
  });

  const serviceMap = new Map(services.map((s) => [s.id, s]));

  let subtotal = 0;
  const itemSnapshots = items.map((item) => {
    const s = serviceMap.get(item.service_id);
    if (!s) {
      throw new Error(`Layanan ID ${item.service_id} tidak valid atau tidak aktif.`);
    }
    const itemSubtotal = s.price * item.quantity;
    subtotal += itemSubtotal;

    return {
      service_id: s.id,
      quantity: item.quantity,
      unit_price: s.price, // Snapshot current price
      subtotal: itemSubtotal,
      note: item.note || null,
    };
  });

  // 2. Promo Calculation
  const promoResult = await calculatePromoDiscount(promo_code, subtotal);
  const discountAmount = promoResult.discountAmount;

  // 3. Delivery Fee
  const deliveryFee = calculateDeliveryFee(fulfillment_type, subtotal);

  // 4. Grand Total
  const total = Math.max(0, subtotal - discountAmount + deliveryFee);
  const orderNo = generateOrderNo();
  const operatorId = changed_by || customer_id;

  // 5. Database Transaction
  const order = await prisma.$transaction(async (tx) => {
    // A. Create Order
    const newOrder = await tx.order.create({
      data: {
        order_no: orderNo,
        customer_id,
        outlet_id,
        promo_id: promoResult.promoId,
        order_source,
        fulfillment_type,
        status: "pending",
        subtotal,
        discount_amount: discountAmount,
        delivery_fee: deliveryFee,
        total,
        notes: notes || null,
        items: {
          create: itemSnapshots,
        },
      },
      include: {
        items: { include: { service: true } },
        customer: true,
        outlet: true,
      },
    });

    // B. Audit Log
    await tx.orderStatusLog.create({
      data: {
        order_id: newOrder.id,
        status: "pending",
        changed_by: operatorId,
        note: `Pesanan dibuat via ${order_source === "walk_in" ? "Kasir Walk-in" : "Aplikasi Online"}`,
      },
    });

    // C. Increment Promo Used Count if applied
    if (promoResult.promoId) {
      await tx.promo.update({
        where: { id: promoResult.promoId },
        data: { used_count: { increment: 1 } },
      });
    }

    // D. If pickup & delivery with address, create delivery task
    if (fulfillment_type === "pickup_delivery" && address_id) {
      await tx.delivery.create({
        data: {
          order_id: newOrder.id,
          address_id,
          type: "pickup",
          scheduled_at: scheduled_at ? new Date(scheduled_at) : new Date(Date.now() + 3600000), // Default 1 hour later
          status: "scheduled",
        },
      });
    }

    return newOrder;
  });

  // 6. Trigger Asynchronous Notification
  try {
    const servicesSummary = order.items.map((i) => `${i.service.name} (${i.quantity} ${i.service.unit})`).join(", ");
    const trackingUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`;

    const message = formatOrderMessage("order_created", {
      customerName: order.customer.name,
      orderNo: order.order_no,
      services: servicesSummary,
      total: order.total,
      fulfillment: fulfillment_type === "pickup_delivery" ? "Antar-Jemput (Pickup & Delivery)" : "Drop-off di Outlet",
      trackingUrl,
    });

    await sendNotification({
      userId: customer_id,
      orderId: order.id,
      channel: "whatsapp",
      message,
    });
  } catch (err) {
    console.error("Gagal mengirim notifikasi pembuatan order:", err);
  }

  return order;
}

/**
 * Status Transition Engine with Mandatory Audit Logging & Notification
 */
export async function transitionOrderStatus(params: {
  orderId: number;
  newStatus: string;
  changedByUserId: number;
  note?: string;
}) {
  const { orderId, newStatus, changedByUserId, note } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, outlet: true },
  });

  if (!order) {
    throw new Error(`Pesanan dengan ID ${orderId} tidak ditemukan.`);
  }

  // Update order status and append audit log atomically
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const res = await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: { include: { service: true } },
        customer: true,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        order_id: orderId,
        status: newStatus,
        changed_by: changedByUserId,
        note: note || `Status diubah ke ${STATUS_LABELS[newStatus] || newStatus}`,
      },
    });

    return res;
  });

  // Trigger Notification to Customer
  try {
    const trackingUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`;
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;

    let event = "status_changed";
    if (newStatus === "ready") event = "ready";

    const msg = formatOrderMessage(event, {
      customerName: updatedOrder.customer.name,
      orderNo: updatedOrder.order_no,
      statusLabel,
      note: note || "",
      fulfillmentType: updatedOrder.fulfillment_type,
      trackingUrl,
    });

    await sendNotification({
      userId: updatedOrder.customer_id,
      orderId: updatedOrder.id,
      channel: "whatsapp",
      message: msg,
    });
  } catch (err) {
    console.error("Gagal mengirim notifikasi perubahan status:", err);
  }

  return updatedOrder;
}

/**
 * Reweighing Logic (Penyesuaian Berat Kiloan di Outlet)
 */
export async function reweighOrder(params: {
  orderId: number;
  items: { itemId: number; actualQuantity: number }[];
  changedByUserId: number;
  notes?: string;
}) {
  const { orderId, items, changedByUserId, notes } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { service: true } },
      promo: true,
      customer: true,
    },
  });

  if (!order) {
    throw new Error(`Pesanan ID ${orderId} tidak ditemukan.`);
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    let newSubtotal = 0;
    let actualWeightSummary: string[] = [];

    for (const itemInput of items) {
      const existing = order.items.find((i) => i.id === itemInput.itemId);
      if (!existing) continue;

      const updatedSubtotal = Math.round(itemInput.actualQuantity * existing.unit_price);
      newSubtotal += updatedSubtotal;

      await tx.orderItem.update({
        where: { id: itemInput.itemId },
        data: {
          quantity: itemInput.actualQuantity,
          subtotal: updatedSubtotal,
        },
      });

      actualWeightSummary.push(`${existing.service.name}: ${itemInput.actualQuantity} ${existing.service.unit}`);
    }

    // Keep non-updated items in subtotal calculation
    for (const item of order.items) {
      if (!items.some((i) => i.itemId === item.id)) {
        newSubtotal += item.subtotal;
      }
    }

    // Recalculate Promo if applied
    let newDiscount = 0;
    if (order.promo) {
      if (newSubtotal >= order.promo.min_order) {
        if (order.promo.discount_type === "percent") {
          newDiscount = Math.round((newSubtotal * order.promo.discount_value) / 100);
        } else {
          newDiscount = order.promo.discount_value;
        }
        newDiscount = Math.min(newDiscount, newSubtotal);
      }
    }

    // Recalculate Delivery Fee
    const newDeliveryFee = calculateDeliveryFee(order.fulfillment_type, newSubtotal);
    const newTotal = Math.max(0, newSubtotal - newDiscount + newDeliveryFee);

    // Update Order
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: newSubtotal,
        discount_amount: newDiscount,
        delivery_fee: newDeliveryFee,
        total: newTotal,
        status: order.status === "pending" || order.status === "picked_up" ? "received" : order.status,
      },
      include: {
        items: { include: { service: true } },
        customer: true,
      },
    });

    // Mandatory Audit Log
    await tx.orderStatusLog.create({
      data: {
        order_id: orderId,
        status: updated.status,
        changed_by: changedByUserId,
        note: `Penimbangan aktual: ${actualWeightSummary.join(", ")}. Total disesuaikan dari Rp ${order.total.toLocaleString("id-ID")} -> Rp ${newTotal.toLocaleString("id-ID")}${notes ? `. Catatan: ${notes}` : ""}`,
      },
    });

    return { updated, actualWeightSummary };
  });

  // Notify customer about weight adjustment
  try {
    const msg = formatOrderMessage("reweighed", {
      customerName: updatedOrder.updated.customer.name,
      orderNo: updatedOrder.updated.order_no,
      actualWeight: updatedOrder.actualWeightSummary.join(", "),
      newTotal: updatedOrder.updated.total,
    });

    await sendNotification({
      userId: updatedOrder.updated.customer_id,
      orderId: updatedOrder.updated.id,
      channel: "whatsapp",
      message: msg,
    });
  } catch (err) {
    console.error("Gagal mengirim notifikasi penimbangan aktual:", err);
  }

  return updatedOrder.updated;
}
