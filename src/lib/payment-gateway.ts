import { prisma } from "@/lib/prisma";
import { formatOrderMessage, sendNotification } from "@/lib/notifications";

export interface PaymentChargeParams {
  order_id: number;
  method: "qris" | "bank_transfer" | "ewallet" | "cash";
  bank?: "bca" | "mandiri" | "bni" | "bri";
  ewallet_channel?: "gopay" | "ovo" | "shopeepay" | "dana";
  user_id?: number;
}

export interface PaymentChargeResult {
  payment_id: number;
  order_id: number;
  order_no: string;
  amount: number;
  method: string;
  channel_name: string;
  gateway_ref: string;
  qr_string?: string;
  va_number?: string;
  bank?: string;
  ewallet_channel?: string;
  checkout_url?: string;
  expired_at: string;
  instructions: { title: string; steps: string[] }[];
}

// Generate Virtual Account per Bank
function generateVirtualAccount(bank: string, customerPhone: string, orderId: number): string {
  const cleanPhone = customerPhone.replace(/\D/g, "").slice(-8).padStart(8, "0");
  const padOrder = String(orderId).padStart(4, "0");

  switch (bank.toLowerCase()) {
    case "bca":
      return `12800${cleanPhone}`;
    case "mandiri":
      return `88908${cleanPhone}`;
    case "bni":
      return `8277${cleanPhone}`;
    case "bri":
      return `10777${cleanPhone}`;
    default:
      return `8800${cleanPhone}${padOrder}`;
  }
}

// Standard Indonesian QRIS Mock String (EMVCo QR standard payload format)
function generateQRISPayload(orderNo: string, amount: number): string {
  const amountStr = Math.round(amount).toString();
  return `00020101021226680016ID.CO.LAUNDRYHUB.WWW011893600911002233445502150000000000000000303UMI51440014ID.LINKAJA.WWW0215202611230000001520472995303360540${amountStr.length.toString().padStart(2, "0")}${amountStr}5802ID5918LAUNDRYHUB KEDATON6014BANDAR LAMPUNG61053514262270723${orderNo}6304A1B2`;
}

export async function createPaymentCharge(params: PaymentChargeParams): Promise<PaymentChargeResult> {
  const { order_id, method, bank = "bca", ewallet_channel = "gopay" } = params;

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: {
      customer: true,
      payments: { orderBy: { created_at: "desc" }, take: 1 },
      outlet: true,
    },
  });

  if (!order) {
    throw new Error("Pesanan tidak ditemukan.");
  }

  // Check if order already has a paid payment
  const isAlreadyPaid = order.payments.some((p) => p.status === "paid");
  if (isAlreadyPaid) {
    throw new Error("Pesanan ini sudah berstatus LUNAS.");
  }

  const gatewayRef = `GW-${method.toUpperCase()}-${order.order_no}-${Date.now().toString().slice(-6)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes expiry

  // Upsert or create payment record
  let paymentRecord = order.payments[0];
  if (paymentRecord && paymentRecord.status === "pending") {
    paymentRecord = await prisma.payment.update({
      where: { id: paymentRecord.id },
      data: {
        method: method === "bank_transfer" ? `${bank}_va` : method === "ewallet" ? ewallet_channel : method,
        amount: order.total,
        gateway_ref: gatewayRef,
      },
    });
  } else {
    paymentRecord = await prisma.payment.create({
      data: {
        order_id: order.id,
        method: method === "bank_transfer" ? `${bank}_va` : method === "ewallet" ? ewallet_channel : method,
        amount: order.total,
        status: "pending",
        gateway_ref: gatewayRef,
      },
    });
  }

  if (method === "qris") {
    const qrString = generateQRISPayload(order.order_no, order.total);
    return {
      payment_id: paymentRecord.id,
      order_id: order.id,
      order_no: order.order_no,
      amount: order.total,
      method: "qris",
      channel_name: "QRIS Nasional (Semua Bank & E-Wallet)",
      gateway_ref: gatewayRef,
      qr_string: qrString,
      expired_at: expiresAt,
      instructions: [
        {
          title: "Cara Pembayaran via QRIS",
          steps: [
            "Buka aplikasi mobile banking (BCA Mobile, Livin' by Mandiri, BRImo, BNI Mobile) atau e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja).",
            "Pilih menu 'Scan QR' atau 'Bayar dengan QR'.",
            "Arahkan kamera HP ke QR Code yang ditampilkan pada layar.",
            `Periksa nama merchant: 'LaundryHub Kedaton' dan nominal Rp ${order.total.toLocaleString("id-ID")}.`,
            "Masukkan PIN transaksi Anda untuk menyelesaikan pembayaran.",
            "Sistem LaundryHub akan memverifikasi dan mengubah status menjadi LUNAS secara instan.",
          ],
        },
      ],
    };
  }

  if (method === "bank_transfer") {
    const vaNumber = generateVirtualAccount(bank, order.customer.phone, order.id);
    const bankName = bank.toUpperCase();

    return {
      payment_id: paymentRecord.id,
      order_id: order.id,
      order_no: order.order_no,
      amount: order.total,
      method: "bank_transfer",
      bank,
      channel_name: `Virtual Account ${bankName}`,
      gateway_ref: gatewayRef,
      va_number: vaNumber,
      expired_at: expiresAt,
      instructions: [
        {
          title: `Petunjuk Transfer ${bankName} Mobile Banking`,
          steps: [
            `Login ke aplikasi ${bankName} Mobile Anda.`,
            "Pilih menu 'Transfer' lalu pilih 'Virtual Account' atau 'Pembayaran'.",
            `Masukkan Nomor Virtual Account: ${vaNumber}.`,
            `Pastikan nama penerima tertera 'LaundryHub - ${order.customer.name}' dan nominal Rp ${order.total.toLocaleString("id-ID")}.`,
            "Konfirmasi transaksi dan masukkan PIN Anda.",
            "Simpan bukti transaksi. Pembayaran akan terverifikasi otomatis.",
          ],
        },
        {
          title: `Petunjuk Transfer ${bankName} ATM`,
          steps: [
            "Masukkan kartu ATM dan PIN Anda.",
            "Pilih menu 'Transaksi Lainnya' > 'Transfer' > 'Ke Rek Virtual Account'.",
            `Masukkan Nomor Virtual Account: ${vaNumber}.`,
            "Periksa rincian pembayaran pada layar ATM, lalu tekan 'Benar/Ya'.",
            "Transaksi selesai. Simpan struk ATM Anda.",
          ],
        },
      ],
    };
  }

  if (method === "ewallet") {
    const channelName =
      ewallet_channel === "gopay"
        ? "GoPay"
        : ewallet_channel === "ovo"
        ? "OVO"
        : ewallet_channel === "shopeepay"
        ? "ShopeePay"
        : "DANA";

    return {
      payment_id: paymentRecord.id,
      order_id: order.id,
      order_no: order.order_no,
      amount: order.total,
      method: "ewallet",
      ewallet_channel,
      channel_name: `E-Wallet ${channelName}`,
      gateway_ref: gatewayRef,
      checkout_url: `https://simulator.payment-gateway.id/${ewallet_channel}/pay?ref=${gatewayRef}`,
      expired_at: expiresAt,
      instructions: [
        {
          title: `Pembayaran via ${channelName}`,
          steps: [
            `Pastikan saldo aplikasi ${channelName} Anda mencukupi Rp ${order.total.toLocaleString("id-ID")}.`,
            `Buka notifikasi atau aplikasi ${channelName} di smartphone Anda.`,
            "Konfirmasi rincian pesanan LaundryHub dan selesaikan pembayaran.",
            "Status pembayaran akan terupdate otomatis dalam hitungan detik.",
          ],
        },
      ],
    };
  }

  // Fallback
  return {
    payment_id: paymentRecord.id,
    order_id: order.id,
    order_no: order.order_no,
    amount: order.total,
    method: "cash",
    channel_name: "Tunai / Cash",
    gateway_ref: gatewayRef,
    expired_at: expiresAt,
    instructions: [
      {
        title: "Pembayaran Tunai di Outlet",
        steps: ["Silakan bayar langsung ke kasir workshop laundry saat penyerahan pakaian."],
      },
    ],
  };
}

export async function verifyPayment(orderId: number, paymentId?: number, changedByUserId?: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      payments: true,
      outlet: true,
    },
  });

  if (!order) {
    throw new Error("Pesanan tidak ditemukan.");
  }

  // Find target payment or pending payment
  const targetPayment = paymentId
    ? order.payments.find((p) => p.id === paymentId)
    : order.payments.find((p) => p.status === "pending") || order.payments[0];

  const operatorId = changedByUserId || order.customer_id;
  const now = new Date();
  const paymentMethodLabel = targetPayment?.method?.toUpperCase() || "ONLINE_GATEWAY";

  const updatedResult = await prisma.$transaction(async (tx) => {
    let finalPayment;
    if (targetPayment) {
      finalPayment = await tx.payment.update({
        where: { id: targetPayment.id },
        data: {
          status: "paid",
          paid_at: now,
          gateway_ref: targetPayment.gateway_ref || `GW-${paymentMethodLabel}-${Date.now().toString().slice(-6)}`,
        },
      });
    } else {
      finalPayment = await tx.payment.create({
        data: {
          order_id: order.id,
          method: "qris",
          amount: order.total,
          status: "paid",
          paid_at: now,
          gateway_ref: `GW-QRIS-${Date.now().toString().slice(-6)}`,
        },
      });
    }

    // Append Audit Trail
    await tx.orderStatusLog.create({
      data: {
        order_id: order.id,
        status: order.status,
        changed_by: operatorId,
        note: `Pembayaran online berhasil via Payment Gateway (${finalPayment.method.toUpperCase()} - Ref: ${finalPayment.gateway_ref}). Status: LUNAS.`,
      },
    });

    return finalPayment;
  });

  // Send WhatsApp notification
  try {
    const msg = formatOrderMessage("status_changed", {
      customerName: order.customer.name,
      orderNo: order.order_no,
      statusLabel: "Pembayaran Lunas Terverifikasi",
      note: `Pembayaran sebesar Rp ${order.total.toLocaleString("id-ID")} melalui ${updatedResult.method.toUpperCase()} telah diverifikasi oleh Payment Gateway. Pakaian Anda diproses di workshop.`,
      trackingUrl: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`,
    });

    await sendNotification({
      userId: order.customer_id,
      orderId: order.id,
      channel: "whatsapp",
      message: msg,
    });
  } catch (err) {
    console.error("Failed to send payment verification notification:", err);
  }

  return {
    success: true,
    message: "Pembayaran berhasil diverifikasi dan pesanan telah LUNAS.",
    payment: updatedResult,
  };
}
