import crypto from "crypto";

export interface MidtransCustomer {
  name: string;
  phone: string;
  email?: string;
}

export interface MidtransItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateSnapParams {
  orderId: number;
  orderNo: string;
  total: number;
  customer: MidtransCustomer;
  items?: MidtransItem[];
}

export interface SnapTransactionResult {
  token: string;
  redirect_url: string;
  is_sandbox: boolean;
}

export function isMidtransConfigured(): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  return Boolean(serverKey && serverKey.trim().length > 0 && !serverKey.includes("YOUR_MIDTRANS"));
}

export function getMidtransBaseUrl(): string {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

export function getMidtransClientKey(): string {
  return process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
}

/**
 * Generate Snap Transaction Token from Midtrans API
 */
export async function createMidtransSnapTransaction(
  params: CreateSnapParams
): Promise<SnapTransactionResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi di file .env");
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const endpoint = getMidtransBaseUrl();
  const authHeader = `Basic ${Buffer.from(`${serverKey.trim()}:`).toString("base64")}`;

  // Unique Midtrans order_id (append timestamp to avoid duplicate order ID rejections on retry)
  const midtransOrderId = `${params.orderNo}-${Date.now().toString().slice(-4)}`;

  const cleanPhone = params.customer.phone.replace(/[^0-9+]/g, "");

  const itemDetails = (params.items && params.items.length > 0)
    ? params.items.map((i) => ({
        id: String(i.id).slice(0, 50),
        price: Math.round(i.price),
        quantity: i.quantity,
        name: i.name.slice(0, 50),
      }))
    : [
        {
          id: `ORD-${params.orderId}`,
          price: Math.round(params.total),
          quantity: 1,
          name: `LaundryHub #${params.orderNo}`,
        },
      ];

  // Adjust item total if rounding differs from params.total
  const itemsSum = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (itemsSum !== Math.round(params.total)) {
    itemDetails.length = 0;
    itemDetails.push({
      id: `ORD-${params.orderId}`,
      price: Math.round(params.total),
      quantity: 1,
      name: `LaundryHub #${params.orderNo}`,
    });
  }

  const payload = {
    transaction_details: {
      order_id: midtransOrderId,
      gross_amount: Math.round(params.total),
    },
    customer_details: {
      first_name: params.customer.name.slice(0, 30),
      phone: cleanPhone || "081234567890",
      email: params.customer.email || `${params.orderNo.toLowerCase()}@laundryhub.local`,
    },
    item_details: itemDetails,
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${params.orderNo}`,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();

  if (!res.ok) {
    const errMsg = responseJson.error_messages?.join(", ") || responseJson.message || "Gagal menghubungi API Midtrans.";
    throw new Error(`Midtrans Error (${res.status}): ${errMsg}`);
  }

  return {
    token: responseJson.token,
    redirect_url: responseJson.redirect_url,
    is_sandbox: !isProduction,
  };
}

/**
 * Verify Midtrans Webhook SHA512 Signature Key
 * signature_key = sha512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !payload.signature_key) return false;

  const raw = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey.trim()}`;
  const computedHash = crypto.createHash("sha512").update(raw).digest("hex");

  return computedHash.toLowerCase() === payload.signature_key.toLowerCase();
}
