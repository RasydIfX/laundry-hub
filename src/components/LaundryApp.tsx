"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Scale,
  Clock,
  MapPin,
  Truck,
  Shirt,
  Sparkles,
  Search,
  Check,
  ChevronRight,
  Printer,
  Shield,
  ArrowRight,
  RotateCcw,
  Sliders,
  Send,
  Building2,
  FileText,
  BadgeCheck,
  User,
  LogOut,
  CreditCard,
  QrCode,
  Star,
  RefreshCw,
  AlertCircle,
  PackageCheck,
  Phone,
  Navigation,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

type ViewMode = "landing" | "order" | "tracking" | "kasir" | "admin" | "kurir";

interface ServiceItem {
  id: number;
  category_id: number;
  name: string;
  unit: string;
  price: number;
  est_duration_hours: number;
  is_active: boolean;
  category?: { name: string };
}

interface OutletItem {
  id: number;
  name: string;
  address: string;
  phone: string;
  open_hours: string;
}

interface PromoItem {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
}

interface OrderDetail {
  id: number;
  order_no: string;
  customer_id: number;
  outlet_id: number;
  order_source: string;
  fulfillment_type: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  created_at: string;
  customer: { id: number; name: string; phone: string; email?: string };
  outlet: { id: number; name: string; address: string; phone: string };
  promo?: { code: string; discount_type: string; discount_value: number };
  items: {
    id: number;
    service_id: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
    service: { name: string; unit: string; category?: { name: string } };
  }[];
  payments: {
    id: number;
    method: string;
    amount: number;
    status: string;
    paid_at?: string;
  }[];
  deliveries: {
    id: number;
    type: string;
    status: string;
    scheduled_at: string;
    courier?: { id: number; name: string; phone: string };
    address?: { label: string; full_address: string };
  }[];
  status_logs: {
    id: number;
    status: string;
    note?: string;
    created_at: string;
    user: { name: string; role: string };
  }[];
  review?: {
    rating: number;
    comment: string;
    created_at: string;
  };
}

interface DeliveryTask {
  id: number;
  order_id: number;
  courier_id?: number | null;
  courier?: { id: number; name: string; phone: string } | null;
  type: string;
  status: string;
  scheduled_at: string;
  order: {
    order_no: string;
    status: string;
    total: number;
    customer: { name: string; phone: string };
    outlet: { name: string };
    items: { service: { name: string }; quantity: number }[];
  };
  address: { label: string; full_address: string };
}

const ORDER_STEPS = [
  { id: "pending", label: "Dipesan" },
  { id: "picked_up", label: "Dijemput" },
  { id: "received", label: "Ditimbang" },
  { id: "washing", label: "Dicuci" },
  { id: "ironing", label: "Disetrika" },
  { id: "ready", label: "Siap" },
  { id: "delivering", label: "Diantar" },
  { id: "completed", label: "Selesai" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Penjemputan",
  picked_up: "Dijemput Kurir",
  received: "Diterima Workshop",
  washing: "Sedang Dicuci",
  ironing: "Sedang Disetrika",
  ready: "Selesai & Siap",
  delivering: "Sedang Diantar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export default function LaundryApp() {
  const { user, token, addresses, login, register, logout } = useAuth();
  const [view, setView] = useState<ViewMode>("landing");

  // Master Data from DB
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [promos, setPromos] = useState<PromoItem[]>([]);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Simulator Timbangan Digital
  const [scaleServiceId, setScaleServiceId] = useState<number>(0);
  const [scaleWeight, setScaleWeight] = useState<number>(4.2);

  // State Pemesanan
  const [orderServiceId, setOrderServiceId] = useState<number>(0);
  const [orderQty, setOrderQty] = useState<number>(3.5);
  const [orderFulfillment, setOrderFulfillment] = useState<"pickup_delivery" | "drop_off">("pickup_delivery");
  const [orderOutletId, setOrderOutletId] = useState<number>(3); // Kedaton
  const [orderAddressId, setOrderAddressId] = useState<number | "">("");
  const [orderGuestAddress, setOrderGuestAddress] = useState("Jl. ZA Pagar Alam No. 45, Gedong Meneng, Rajabasa, Bandar Lampung");
  const [orderGuestName, setOrderGuestName] = useState("");
  const [orderGuestPhone, setOrderGuestPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSlot, setOrderSlot] = useState("09:00 - 11:00 WIB (Pagi)");
  const [promoCodeInput, setPromoCodeInput] = useState("BERSIHHEMAT");
  const [promoDiscountVal, setPromoDiscountVal] = useState<number>(0);
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // State Tracking Detail
  const [activeOrderNo, setActiveOrderNo] = useState("");
  const [orderSearchInput, setOrderSearchInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<OrderDetail | null>(null);
  const [myOrdersList, setMyOrdersList] = useState<OrderDetail[]>([]);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // State Review Form
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // State Kasir POS & Reweigh
  const [kasirOrders, setKasirOrders] = useState<OrderDetail[]>([]);
  const [kasirSelectedOrder, setKasirSelectedOrder] = useState<OrderDetail | null>(null);
  const [kasirActualWeight, setKasirActualWeight] = useState<number>(4.0);
  const [kasirReweighNote, setKasirReweighNote] = useState("");
  const [isReweighing, setIsReweighing] = useState(false);

  // Kasir Walk-in Direct
  const [walkInName, setWalkInName] = useState("Bpk. Joko");
  const [walkInPhone, setWalkInPhone] = useState("081299887766");
  const [walkInServiceId, setWalkInServiceId] = useState<number>(0);
  const [walkInQty, setWalkInQty] = useState<number>(3.5);
  const [walkInOutletId, setWalkInOutletId] = useState<number>(3);
  const [walkInPayCash, setWalkInPayCash] = useState(true);

  // State Admin Report
  const [adminReport, setAdminReport] = useState<{
    revenue: { total: number; order_count: number };
    top_services: { name: string; total_quantity: number; total_revenue: number }[];
    customers: { total: number };
    reviews: { average_rating: number; total_reviews: number };
  } | null>(null);
  const [adminOrders, setAdminOrders] = useState<OrderDetail[]>([]);

  // State Kurir Task View
  const [courierTasks, setCourierTasks] = useState<DeliveryTask[]>([]);
  const [isLoadingCourier, setIsLoadingCourier] = useState(false);

  // 1. Load Initial Master Data
  const loadMasterData = useCallback(async () => {
    try {
      const [svcRes, outRes, promoRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/outlets"),
        fetch("/api/promos"),
      ]);

      if (svcRes.ok) {
        const sData = await svcRes.json();
        if (sData.success && sData.data) {
          setServices(sData.data);
          if (sData.data.length > 0) {
            setScaleServiceId(sData.data[0].id);
            setOrderServiceId(sData.data[0].id);
            setWalkInServiceId(sData.data[0].id);
          }
        }
      }

      if (outRes.ok) {
        const oData = await outRes.json();
        if (oData.success && oData.data) {
          setOutlets(oData.data);
          if (oData.data.length > 0) {
            setOrderOutletId(oData.data[0].id);
            setWalkInOutletId(oData.data[0].id);
          }
        }
      }

      if (promoRes.ok) {
        const pData = await promoRes.json();
        if (pData.success && pData.data) {
          setPromos(pData.data);
        }
      }
    } catch (e) {
      console.error("Gagal memuat master data:", e);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // 2. Fetch Tracked Order by order_no
  const fetchTrackedOrder = useCallback(async (no: string) => {
    if (!no) return;
    setIsLoadingTrack(true);
    setTrackError(null);
    try {
      const res = await fetch(`/api/orders?order_no=${encodeURIComponent(no.trim())}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTrackedOrder(data.data);
      } else {
        setTrackError(data.error || "Pesanan tidak ditemukan.");
        setTrackedOrder(null);
      }
    } catch {
      setTrackError("Gagal menghubungi server pelacakan.");
      setTrackedOrder(null);
    } finally {
      setIsLoadingTrack(false);
    }
  }, []);

  useEffect(() => {
    if (activeOrderNo) {
      fetchTrackedOrder(activeOrderNo);
    }
  }, [activeOrderNo, fetchTrackedOrder]);

  // 3. Load Customer Orders (if logged in as customer)
  const loadCustomerOrders = useCallback(async () => {
    if (!token || user?.role !== "customer") {
      setMyOrdersList([]);
      return;
    }
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setMyOrdersList(data.data);
          if (data.data.length > 0) {
            // Check if currently tracked order is already in customer's own orders
            const hasActiveOrder = data.data.some((o: OrderDetail) => o.order_no === activeOrderNo);
            if (!hasActiveOrder) {
              const latest = data.data[0].order_no;
              setActiveOrderNo(latest);
              setOrderSearchInput(latest);
              fetchTrackedOrder(latest);
            }
          } else {
            // This customer has NO orders
            setActiveOrderNo("");
            setOrderSearchInput("");
            setTrackedOrder(null);
          }
        }
      }
    } catch (e) {
      console.error("Gagal memuat riwayat pesanan customer:", e);
    }
  }, [token, user?.role, user?.id, activeOrderNo, fetchTrackedOrder]);

  useEffect(() => {
    if (user?.role === "customer") {
      loadCustomerOrders();
    } else {
      setMyOrdersList([]);
    }
  }, [user?.role, user?.id, loadCustomerOrders]);

  // 4. Load Kasir Data
  const loadKasirData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setKasirOrders(data.data);
          if (data.data.length > 0 && !kasirSelectedOrder) {
            setKasirSelectedOrder(data.data[0]);
            if (data.data[0].items[0]) {
              setKasirActualWeight(data.data[0].items[0].quantity);
            }
          }
        }
      }
    } catch (e) {
      console.error("Load kasir data error:", e);
    }
  }, [token, kasirSelectedOrder]);

  // 5. Load Admin Data
  const loadAdminData = useCallback(async () => {
    if (!token) return;
    try {
      const [repRes, ordRes] = await Promise.all([
        fetch("/api/reports", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (repRes.ok) {
        const r = await repRes.json();
        if (r.success) setAdminReport(r.data);
      }
      if (ordRes.ok) {
        const o = await ordRes.json();
        if (o.success) setAdminOrders(o.data);
      }
    } catch (e) {
      console.error("Load admin data error:", e);
    }
  }, [token]);

  // 6. Load Kurir Tasks
  const loadCourierTasks = useCallback(async () => {
    if (!token) return;
    setIsLoadingCourier(true);
    try {
      const res = await fetch("/api/deliveries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setCourierTasks(data.data);
        }
      }
    } catch (e) {
      console.error("Load courier tasks error:", e);
    } finally {
      setIsLoadingCourier(false);
    }
  }, [token]);

  // Fetch relevant role data when view or user changes
  useEffect(() => {
    if (view === "kasir" && (user?.role === "kasir" || user?.role === "admin")) {
      loadKasirData();
    }
    if (view === "admin" && user?.role === "admin") {
      loadAdminData();
    }
    if (view === "kurir" && (user?.role === "kurir" || user?.role === "admin")) {
      loadCourierTasks();
    }
  }, [view, user?.role, loadKasirData, loadAdminData, loadCourierTasks]);

  // Auto-redirect view on login or role change
  const handleRoleChangedView = (role: string | undefined) => {
    if (role === "admin") {
      setView("admin");
    } else if (role === "kasir") {
      setView("kasir");
    } else if (role === "kurir") {
      setView("kurir");
    } else {
      setView("landing");
    }
  };

  // One-Click Demo Role Switcher
  const handleQuickLogin = async (phone: string, roleName: string) => {
    // Reset state before switching so data doesn't leak between accounts
    setMyOrdersList([]);
    setTrackedOrder(null);
    setActiveOrderNo("");
    setOrderSearchInput("");
    setKasirOrders([]);
    setCourierTasks([]);
    setAdminReport(null);

    const res = await login(phone, "Password123!");
    if (res.ok) {
      alert(`✓ Berhasil login sebagai: ${roleName}`);
      setShowAuthModal(false);
      // Auto switch view based on role
      if (phone === "081234567890") setView("admin");
      else if (phone === "081234567891") setView("kasir");
      else if (phone === "081234567892") setView("kurir");
      else setView("tracking");
    } else {
      alert(`Login gagal: ${res.error}`);
    }
  };

  // Calculate Active Simulator Price
  const currentScaleService = services.find((s) => s.id === scaleServiceId) || services[0];
  const scaleSubtotal = (currentScaleService?.price || 8000) * scaleWeight;
  const scaleDiscount = scaleSubtotal * 0.15;
  const scaleFinal = scaleSubtotal - scaleDiscount;

  // Calculate Order Form Price
  const currentOrderService = services.find((s) => s.id === orderServiceId) || services[0];
  const orderUnitPrice = currentOrderService?.price || 8000;
  const orderSubtotal = orderUnitPrice * orderQty;
  const orderDeliveryFee = orderFulfillment === "pickup_delivery" ? (orderSubtotal >= 50000 ? 0 : 10000) : 0;
  const orderGrandTotal = Math.max(0, orderSubtotal - promoDiscountVal + orderDeliveryFee);

  // Validate Promo Code
  const handleValidatePromo = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const res = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCodeInput, subtotal: orderSubtotal }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPromoDiscountVal(data.data.discount_amount);
        setPromoFeedback(`✓ Voucher ${data.data.code} berhasil dipasang (Diskon Rp ${data.data.discount_amount.toLocaleString("id-ID")})`);
      } else {
        setPromoDiscountVal(0);
        setPromoFeedback(data.error || "Voucher tidak valid atau kuota habis.");
      }
    } catch {
      setPromoFeedback("Gagal memvalidasi kode promo.");
    }
  };

  // Submit New Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingOrder(true);
    try {
      const payload: Record<string, unknown> = {
        outlet_id: orderOutletId,
        fulfillment_type: orderFulfillment,
        order_source: "online",
        promo_code: promoDiscountVal > 0 ? promoCodeInput : undefined,
        notes: `${orderNotes ? orderNotes + " | " : ""}Slot: ${orderSlot}`,
        items: [
          {
            service_id: orderServiceId,
            quantity: orderQty,
          },
        ],
      };

      if (user) {
        if (orderFulfillment === "pickup_delivery") {
          if (orderAddressId) {
            payload.address_id = orderAddressId;
          } else if (addresses.length > 0) {
            payload.address_id = addresses[0].id;
          } else {
            payload.guest_address = orderGuestAddress;
          }
        }
      } else {
        // Guest Checkout
        if (!orderGuestName.trim() || !orderGuestPhone.trim()) {
          alert("Harap isi nama dan nomor WhatsApp Anda untuk konfirmasi pesanan.");
          setIsSubmittingOrder(false);
          return;
        }
        payload.guest_name = orderGuestName.trim();
        payload.guest_phone = orderGuestPhone.trim();
        if (orderFulfillment === "pickup_delivery") {
          payload.guest_address = orderGuestAddress;
        }
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data) {
        alert(
          `✓ Pesanan #${data.data.order_no} berhasil dibuat!\nEstimasi Total: Rp ${data.data.total.toLocaleString("id-ID")}\nKurir akan menjemput sesuai slot waktu.`
        );
        setActiveOrderNo(data.data.order_no);
        setOrderSearchInput(data.data.order_no);
        fetchTrackedOrder(data.data.order_no);
        if (user?.role === "customer") {
          loadCustomerOrders();
        }
        setView("tracking");
      } else {
        alert(`Gagal membuat pesanan: ${data.error || "Terjadi kesalahan"}`);
      }
    } catch {
      alert("Koneksi gagal saat membuat pesanan.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Kasir Walk-in Submit
  const handleWalkInOrder = async () => {
    try {
      const payload = {
        outlet_id: walkInOutletId,
        order_source: "walk_in",
        fulfillment_type: "drop_off",
        guest_name: walkInName,
        guest_phone: walkInPhone,
        items: [{ service_id: walkInServiceId, quantity: walkInQty }],
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.data) {
        if (walkInPayCash) {
          await fetch("/api/payments", {
            method: "POST",
            headers,
            body: JSON.stringify({
              order_id: data.data.id,
              method: "cash",
              amount: data.data.total,
            }),
          });
        }

        alert(`✓ Nota Walk-in #${data.data.order_no} berhasil dicatat! Status: LUNAS.`);
        setActiveOrderNo(data.data.order_no);
        setOrderSearchInput(data.data.order_no);
        loadKasirData();
      } else {
        alert(`Gagal: ${data.error}`);
      }
    } catch {
      alert("Gagal mencatat transaksi kasir.");
    }
  };

  // Kasir Reweigh Actual Weight
  const handleReweighSubmit = async () => {
    if (!kasirSelectedOrder) return;
    setIsReweighing(true);
    try {
      const firstItem = kasirSelectedOrder.items[0];
      if (!firstItem) return;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/orders/${kasirSelectedOrder.id}/reweigh`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: [{ itemId: firstItem.id, actualQuantity: kasirActualWeight }],
          notes: kasirReweighNote || "Penimbangan fisik di outlet Kedaton",
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        alert(
          `✓ Penimbangan aktual berhasil dicatat!\nTotal Baru: Rp ${data.data.total.toLocaleString("id-ID")}\nPesan notifikasi penyesuaian otomatis dikirim ke WhatsApp pelanggan.`
        );
        loadKasirData();
        if (activeOrderNo === kasirSelectedOrder.order_no) {
          fetchTrackedOrder(activeOrderNo);
        }
      } else {
        alert(`Gagal: ${data.error}`);
      }
    } catch {
      alert("Gagal memperbarui penimbangan.");
    } finally {
      setIsReweighing(false);
    }
  };

  // Submit Review
  const handleSubmitReview = async () => {
    if (!trackedOrder || !token) {
      alert("Silakan login sebagai pelanggan terlebih dahulu untuk mengirim ulasan.");
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: trackedOrder.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✓ Terima kasih atas ulasan bintang Anda!");
        fetchTrackedOrder(trackedOrder.order_no);
      } else {
        alert(`Gagal mengirim ulasan: ${data.error}`);
      }
    } catch {
      alert("Koneksi gagal.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Kurir Update Status
  const handleUpdateDeliveryStatus = async (deliveryId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Status tugas pengantaran berhasil diubah ke: ${newStatus}`);
        loadCourierTasks();
        loadKasirData();
        if (activeOrderNo) fetchTrackedOrder(activeOrderNo);
      } else {
        alert(`Gagal: ${data.error}`);
      }
    } catch {
      alert("Koneksi gagal.");
    }
  };

  // Kasir / Admin Update Status Pesanan
  const handleUpdateOrderStatus = async (orderId: number, newStatus: string, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          note: note || `Status diperbarui menjadi ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadKasirData();
        if (isAdmin) loadAdminData();
        if (activeOrderNo) fetchTrackedOrder(activeOrderNo);
      } else {
        alert(`Gagal mengubah status: ${data.error || "Terjadi kesalahan"}`);
      }
    } catch {
      alert("Koneksi gagal saat memperbarui status pesanan.");
    }
  };

  // Kasir Terima Pembayaran Tunai
  const handleCashPayment = async (orderId: number, amount: number) => {
    if (!confirm(`Konfirmasi penerimaan pembayaran tunai sebesar Rp ${amount.toLocaleString("id-ID")}?`)) return;
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          method: "cash",
          amount: amount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✓ Pembayaran tunai lunas berhasil dicatat!");
        loadKasirData();
        if (isAdmin) loadAdminData();
        if (activeOrderNo) fetchTrackedOrder(activeOrderNo);
      } else {
        alert(`Gagal: ${data.error || "Gagal mencatat pembayaran"}`);
      }
    } catch {
      alert("Koneksi gagal saat mencatat pembayaran.");
    }
  };

  // Determine user role flags
  const isGuestOrCustomer = !user || user.role === "customer";
  const isKasir = user?.role === "kasir";
  const isAdmin = user?.role === "admin";
  const isKurir = user?.role === "kurir";

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#141619] font-sans selection:bg-[#0f172a] selection:text-white" suppressHydrationWarning>
      {/* ============================================================== */}
      {/* TOP HEADER BAR (ROLE-AWARE NAVIGATION)                         */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-[#fbfbfa]/90 backdrop-blur-md border-b border-[#e6e6e2]" suppressHydrationWarning>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4" suppressHydrationWarning>
          {/* Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => {
              if (isAdmin) setView("admin");
              else if (isKasir) setView("kasir");
              else if (isKurir) setView("kurir");
              else setView("landing");
            }}
          >
            <span className="w-8 h-8 rounded-lg bg-[#0f172a] text-white font-mono font-bold text-xs flex items-center justify-center">
              LH
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#0f172a] leading-none">
                LaundryHub
              </span>
              <span className="font-mono text-[10px] text-[#64748b] leading-tight">
                {isAdmin ? "Admin Console" : isKasir ? "Terminal Kasir" : isKurir ? "Armada Kurir" : "Bandar Lampung"}
              </span>
            </div>
          </div>

          {/* DYNAMIC ROLE-BASED NAVIGATION */}
          <nav className="flex items-center gap-1 p-1 rounded-lg bg-[#f0f0ec] border border-[#e2e2dc] text-xs font-medium">
            {/* 1. PELANGGAN / GUEST MENU */}
            {isGuestOrCustomer && (
              <>
                <button
                  onClick={() => setView("landing")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "landing"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Katalog Layanan
                </button>
                <button
                  onClick={() => setView("order")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "order"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Pesan Laundry
                </button>
                <button
                  onClick={() => setView("tracking")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "tracking"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  {user ? "Pesanan Saya & Lacak" : "Lacak Status Nota"}
                </button>
              </>
            )}

            {/* 2. KASIR MENU */}
            {isKasir && (
              <>
                <button
                  onClick={() => setView("kasir")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "kasir"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Kasir POS & Walk-in
                </button>
                <button
                  onClick={() => setView("tracking")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "tracking"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Cek Manifest Nota
                </button>
                <button
                  onClick={() => setView("landing")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "landing"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Katalog Tarif
                </button>
              </>
            )}

            {/* 3. KURIR MENU */}
            {isKurir && (
              <>
                <button
                  onClick={() => setView("kurir")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "kurir"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Tugas Antar-Jemput
                </button>
                <button
                  onClick={() => setView("tracking")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "tracking"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Lacak Status Nota
                </button>
              </>
            )}

            {/* 4. SUPER ADMIN MENU */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setView("admin")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "admin"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Dashboard & Laporan
                </button>
                <button
                  onClick={() => setView("kasir")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "kasir"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Kasir POS
                </button>
                <button
                  onClick={() => setView("kurir")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "kurir"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Armada Kurir
                </button>
                <button
                  onClick={() => setView("tracking")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "tracking"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Manifest
                </button>
                <button
                  onClick={() => setView("landing")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    view === "landing"
                      ? "bg-white text-[#0f172a] shadow-xs font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  Katalog
                </button>
              </>
            )}
          </nav>

          {/* User Profile / Auth Area */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-[#0f172a] leading-none">{user.name}</span>
                  <span className="font-mono text-[10px] text-emerald-700 uppercase tracking-wider font-bold">
                    PERAN: {user.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMyOrdersList([]);
                    setTrackedOrder(null);
                    setActiveOrderNo("");
                    setOrderSearchInput("");
                    setKasirOrders([]);
                    setCourierTasks([]);
                    setAdminReport(null);
                    setView("landing");
                  }}
                  title="Logout"
                  className="p-2 rounded-lg bg-white border border-[#e2e2dc] hover:bg-[#f4f4f0] text-[#64748b] hover:text-rose-600 transition-all text-xs"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn-press px-3.5 py-1.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <User className="w-3.5 h-3.5" />
                <span>Masuk Akun</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* QUICK ROLE DEMO BAR — Hanya tampil di development              */}
      {/* ============================================================== */}
      {process.env.NODE_ENV === "development" && (
      <aside aria-label="Demo role selector" className="bg-[#f0f0ec] border-b border-[#e2e2dc] px-4 py-1.5 text-xs font-mono text-[#475569]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-[#0f172a]">Simulasi Peran Pengguna (RBAC):</span>
            <span className="text-[11px] text-[#64748b]">Menu di atas akan menyesuaikan otomatis sesuai hak akses.</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleQuickLogin("081234567893", "Pelanggan Dewi (Way Halim)")}
              className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all ${
                user?.role === "customer"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white hover:bg-[#e2e2dc] border-[#cbd5e1] text-[#0f172a]"
              }`}
            >
              1. Pelanggan
            </button>
            <button
              onClick={() => handleQuickLogin("081234567891", "Kasir Kedaton")}
              className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all ${
                user?.role === "kasir"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white hover:bg-[#e2e2dc] border-[#cbd5e1] text-[#0f172a]"
              }`}
            >
              2. Kasir (Kedaton)
            </button>
            <button
              onClick={() => handleQuickLogin("081234567892", "Kurir BE 4129 YD")}
              className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all ${
                user?.role === "kurir"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white hover:bg-[#e2e2dc] border-[#cbd5e1] text-[#0f172a]"
              }`}
            >
              3. Kurir (Plat BE)
            </button>
            <button
              onClick={() => handleQuickLogin("081234567890", "Super Admin")}
              className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all ${
                user?.role === "admin"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white hover:bg-[#e2e2dc] border-[#cbd5e1] text-[#0f172a]"
              }`}
            >
              4. Super Admin
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* ============================================================== */}
      {/* ACCESS GUARD WARNING (Jika role tidak sesuai dengan URL/Tab)   */}
      {/* ============================================================== */}
      {view === "admin" && !isAdmin && (
        <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-white border border-rose-200 text-center space-y-3">
          <Shield className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="font-semibold text-base text-[#0f172a]">Akses Ditolak (Khusus Admin)</h3>
          <p className="text-xs text-[#64748b]">
            Anda saat ini login sebagai <strong>{user?.name || "Tamu"} ({user?.role || "guest"})</strong>. Halaman ini memerlukan hak akses Super Admin.
          </p>
          <button
            onClick={() => { setShowAuthModal(true); setView("landing"); }}
            className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
          >
            Masuk dengan Akun Admin &rarr;
          </button>
        </div>
      )}

      {view === "kasir" && !isKasir && !isAdmin && (
        <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-white border border-amber-200 text-center space-y-3">
          <Scale className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="font-semibold text-base text-[#0f172a]">Akses Terbatas (Terminal Kasir)</h3>
          <p className="text-xs text-[#64748b]">
            Halaman ini khusus untuk kasir outlet Kedaton/Way Halim untuk penimbangan dan walk-in POS.
          </p>
          <button
            onClick={() => { setShowAuthModal(true); setView("landing"); }}
            className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
          >
            Masuk dengan Akun Kasir &rarr;
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN CONTAINER                                                 */}
      {/* ============================================================== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12" suppressHydrationWarning>
        {/* VIEW 1: KATALOG & TIMBANGAN (Pelanggan / Guest) */}
        {view === "landing" && (
          <div className="space-y-16">
            {/* Hero Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-[#e6e6e2] pb-14">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f0f0ec] border border-[#e2e2dc] text-[11px] font-mono text-[#475569]">
                  <span>BANDAR LAMPUNG</span>
                  <span className="text-[#94a3b8]">•</span>
                  <span>1 MESIN 1 PELANGGAN</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#0f172a] leading-[1.15]">
                  Pencucian higienis satu mesin untuk satu pelanggan di Bandar Lampung.
                </h1>

                <p className="text-base text-[#475569] leading-relaxed max-w-xl">
                  Layanan laundry kiloan dan satuan berstandar hotel untuk Kedaton, Way Halim, Rajabasa, Sukarame, Tanjung Karang, dan sekitarnya. Pakaian dijemput dari pintu rumah atau kos Anda, ditimbang dengan timbangan digital terkalibrasi, disetrika uap boiler bertekanan tinggi, dan dikemas rapi bersegel.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => setView("order")}
                    className="btn-press px-5 py-3 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold tracking-wide flex items-center gap-2 shadow-xs"
                  >
                    <span>Buat Pesanan Jemput di Lampung</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setView("tracking")}
                    className="btn-press px-4 py-3 rounded-lg bg-white border border-[#dcdcd6] hover:bg-[#f4f4f0] text-[#0f172a] text-xs font-medium"
                  >
                    Lacak Status Cucian
                  </button>
                </div>

                {/* Proof specs */}
                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#e6e6e2]">
                  <div>
                    <span className="font-mono text-xs text-[#94a3b8] uppercase block">Durasi Express</span>
                    <strong className="text-base font-semibold text-[#0f172a] mt-0.5 block">6 Jam Siap</strong>
                  </div>
                  <div>
                    <span className="font-mono text-xs text-[#94a3b8] uppercase block">Metode Cuci</span>
                    <strong className="text-base font-semibold text-[#0f172a] mt-0.5 block">1 Mesin 1 Klien</strong>
                  </div>
                  <div>
                    <span className="font-mono text-xs text-[#94a3b8] uppercase block">Standar Setrika</span>
                    <strong className="text-base font-semibold text-[#0f172a] mt-0.5 block">Uap Boiler 3 Bar</strong>
                  </div>
                </div>
              </div>

              {/* Timbangan Digital Simulator */}
              <div className="lg:col-span-5 bg-white border border-[#dcdcd6] rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e6e6e2] pb-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0f172a]">
                    <Scale className="w-4 h-4 text-[#475569]" />
                    <span>TIMBANGAN ESTIMASI BIAYA</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    DATABASE SYNCED
                  </span>
                </div>

                {/* Digital Readout */}
                <div className="p-4 rounded-lg bg-[#0f172a] text-white font-mono flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider block">BERAT ESTIMASI</span>
                    <span className="text-3xl font-bold tracking-tight text-emerald-400">
                      {scaleWeight.toFixed(1)} <span className="text-sm font-normal text-white">kg</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider block">ESTIMASI TOTAL</span>
                    <span className="text-xl font-bold text-white">
                      Rp {scaleFinal.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* Slider Kontrol Berat */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>Atur Berat Cucian:</span>
                    <span className="font-mono font-semibold text-[#0f172a]">{scaleWeight} kg</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.1"
                    value={scaleWeight}
                    onChange={(e) => setScaleWeight(parseFloat(e.target.value))}
                    className="w-full accent-[#0f172a] h-1.5 bg-[#e2e2dc] rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#94a3b8]">
                    <span>1.0 kg</span>
                    <span>7.5 kg</span>
                    <span>15.0 kg</span>
                  </div>
                </div>

                {/* Pilihan Layanan */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-medium text-[#475569] block">Pilihan Layanan:</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {services.slice(0, 4).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScaleServiceId(s.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          scaleServiceId === s.id
                            ? "border-[#0f172a] bg-[#f8fafc] font-semibold text-[#0f172a]"
                            : "border-[#e2e2dc] hover:border-[#cbd5e1] text-[#475569]"
                        }`}
                      >
                        <span className="block font-medium truncate">{s.name}</span>
                        <span className="font-mono text-[11px] text-[#64748b]">
                          Rp {s.price.toLocaleString("id-ID")} /{s.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtotal Itemized */}
                <div className="p-3 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-[#64748b]">
                    <span>Biaya Layanan ({scaleWeight} kg):</span>
                    <span>Rp {scaleSubtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon Promo (-15%):</span>
                    <span>-Rp {scaleDiscount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[#64748b]">
                    <span>Antar-Jemput (Radius Kedaton):</span>
                    <span className="text-emerald-700 font-semibold">GRATIS</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOrderServiceId(scaleServiceId);
                    setOrderQty(scaleWeight);
                    setView("order");
                  }}
                  className="btn-press w-full py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold text-center block transition-all"
                >
                  Pesan dengan Estimasi Ini &rarr;
                </button>
              </div>
            </section>

            {/* Katalog Tarif Jelas */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#64748b]">TARIF DAN SPESIFIKASI</span>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                    Katalog Layanan Workshop Bandar Lampung
                  </h2>
                </div>
                <p className="text-xs text-[#64748b] max-w-md">
                  Harga final mengacu pada penimbangan aktual saat pakaian masuk ke workshop kami di Kedaton atau Way Halim.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {services.map((svc) => (
                  <div key={svc.id} className="p-5 rounded-xl bg-white border border-[#e2e2dc] flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] text-[#475569] uppercase tracking-wider bg-[#f0f0ec] px-2 py-0.5 rounded">
                        {svc.category?.name || "Layanan"}
                      </span>
                      <h3 className="font-semibold text-sm text-[#0f172a]">{svc.name}</h3>
                      <p className="text-xs text-[#64748b] leading-relaxed">
                        Estimasi pengerjaan: {svc.est_duration_hours} jam. Standar setrika boiler uap higienis.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-[#e6e6e2] flex items-baseline justify-between">
                      <div>
                        <strong className="text-base font-semibold text-[#0f172a]">Rp {svc.price.toLocaleString("id-ID")}</strong>
                        <span className="text-xs text-[#64748b]"> /{svc.unit}</span>
                      </div>
                      <button
                        onClick={() => {
                          setOrderServiceId(svc.id);
                          setView("order");
                        }}
                        className="text-xs font-semibold text-[#0f172a] hover:underline"
                      >
                        Pilih &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: WIZARD PEMESANAN (Pelanggan) */}
        {view === "order" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="space-y-1">
              <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider">FORMULIR PENJEMPUTAN LAMPUNG</span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                Buat Pesanan Laundry di Bandar Lampung
              </h2>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-6">
              {/* Step 1: Layanan */}
              <div className="space-y-3 text-xs">
                <label className="font-semibold text-[#0f172a] block">1. Pilih Jenis Layanan</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setOrderServiceId(svc.id)}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        orderServiceId === svc.id
                          ? "border-[#0f172a] bg-[#f8fafc] font-semibold text-[#0f172a]"
                          : "border-[#e2e2dc] hover:border-[#cbd5e1] text-[#475569]"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <strong className="text-sm truncate">{svc.name}</strong>
                        <span className="font-mono text-xs">Rp {svc.price.toLocaleString("id-ID")}</span>
                      </div>
                      <span className="text-[11px] text-[#64748b] block mt-1 font-normal">
                        Estimasi {svc.est_duration_hours} jam. Satuan per {svc.unit}.
                      </span>
                    </button>
                  ))}
                </div>

                {/* Input Estimasi Berat */}
                <div className="p-4 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-[#0f172a]">Perkiraan Berat / Jumlah</span>
                    <span className="font-mono text-[11px] text-[#64748b]">*Ditimbang ulang fisik saat pakaian tiba di outlet</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="50"
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="w-24 p-2 rounded-md bg-white border border-[#cbd5e1] font-mono font-bold text-center text-sm"
                    />
                    <span className="text-xs text-[#64748b]">{currentOrderService?.unit || "kg"}</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Penyerahan & Alamat */}
              <div className="space-y-3 text-xs pt-4 border-t border-[#e6e6e2]">
                <label className="font-semibold text-[#0f172a] block">2. Metode Penyerahan & Outlet Tujuan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderFulfillment("pickup_delivery")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      orderFulfillment === "pickup_delivery"
                        ? "border-[#0f172a] bg-[#f8fafc] font-semibold text-[#0f172a]"
                        : "border-[#e2e2dc] hover:border-[#cbd5e1] text-[#475569]"
                    }`}
                  >
                    <span className="block font-medium">Jemput & Antar Kurir Lampung</span>
                    <span className="font-mono text-[11px] text-[#64748b] mt-0.5 block">
                      {orderSubtotal >= 50000 ? "GRATIS ONGKIR" : "Ongkir Rp 10.000"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderFulfillment("drop_off")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      orderFulfillment === "drop_off"
                        ? "border-[#0f172a] bg-[#f8fafc] font-semibold text-[#0f172a]"
                        : "border-[#e2e2dc] hover:border-[#cbd5e1] text-[#475569]"
                    }`}
                  >
                    <span className="block font-medium">Drop-Off Langsung</span>
                    <span className="font-mono text-[11px] text-[#64748b] mt-0.5 block">Ke Outlet Kedaton / Way Halim</span>
                  </button>
                </div>

                {/* Pilih Outlet */}
                <div>
                  <label className="text-[11px] text-[#64748b] mb-1 block">Pilih Workshop Pemrosesan:</label>
                  <select
                    value={orderOutletId}
                    onChange={(e) => setOrderOutletId(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg bg-white border border-[#cbd5e1] text-xs font-medium"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} — {o.address}
                      </option>
                    ))}
                  </select>
                </div>

                {orderFulfillment === "pickup_delivery" && (
                  <div className="space-y-3 pt-2">
                    {user && addresses.length > 0 ? (
                      <div>
                        <label className="text-[11px] text-[#64748b] mb-1 block">Pilih Alamat Tersimpan:</label>
                        <select
                          value={orderAddressId}
                          onChange={(e) => setOrderAddressId(e.target.value ? Number(e.target.value) : "")}
                          className="w-full p-2.5 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                        >
                          {addresses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}: {a.full_address}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-[#64748b] mb-1 block">Nama Pelanggan:</label>
                            <input
                              type="text"
                              required
                              value={orderGuestName}
                              onChange={(e) => setOrderGuestName(e.target.value)}
                              placeholder="Nama Anda"
                              className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#64748b] mb-1 block">Nomor WhatsApp:</label>
                            <input
                              type="text"
                              required
                              value={orderGuestPhone}
                              onChange={(e) => setOrderGuestPhone(e.target.value)}
                              placeholder="0812xxxxxxx"
                              className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-[#64748b] mb-1 block">Alamat Penjemputan di Bandar Lampung:</label>
                          <textarea
                            rows={2}
                            required
                            value={orderGuestAddress}
                            onChange={(e) => setOrderGuestAddress(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[#64748b] mb-1 block">Slot Waktu:</label>
                        <select
                          value={orderSlot}
                          onChange={(e) => setOrderSlot(e.target.value)}
                          className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                        >
                          <option>09:00 - 11:00 WIB (Pagi)</option>
                          <option>13:00 - 15:00 WIB (Siang)</option>
                          <option>16:00 - 18:30 WIB (Sore)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#64748b] mb-1 block">Catatan Tambahan:</label>
                        <input
                          type="text"
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="Pakaian putih dipisah / parfum sakura"
                          className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Promo & Total */}
              <div className="space-y-3 text-xs pt-4 border-t border-[#e6e6e2]">
                <label className="font-semibold text-[#0f172a] block">3. Kode Voucher & Rincian Biaya</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Contoh: BERSIHHEMAT"
                    className="flex-1 p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono uppercase font-semibold text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleValidatePromo}
                    className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white font-semibold text-xs"
                  >
                    Terapkan
                  </button>
                </div>
                {promoFeedback && (
                  <p className="font-mono text-[11px] text-emerald-700">{promoFeedback}</p>
                )}

                {/* Bill Breakdown */}
                <div className="p-4 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-[#64748b]">
                    <span>Biaya Cucian ({orderQty} {currentOrderService?.unit || "kg"}):</span>
                    <span>Rp {orderSubtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Potongan Diskon:</span>
                    <span>-Rp {promoDiscountVal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[#64748b]">
                    <span>Ongkos Antar-Jemput:</span>
                    <span>{orderDeliveryFee === 0 ? "GRATIS" : `Rp ${orderDeliveryFee.toLocaleString("id-ID")}`}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#0f172a] pt-2 border-t border-[#e2e2dc]">
                    <span>Total Estimasi Bayar:</span>
                    <span>Rp {orderGrandTotal.toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="btn-press w-full py-3 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:bg-[#94a3b8] text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  {isSubmittingOrder ? (
                    <span>Mendaftarkan Pesanan...</span>
                  ) : (
                    <>
                      <span>Konfirmasi Pesanan Laundry</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 3: LIVE TRACKING MANIFEST (Pelanggan / Kasir / Admin) */}
        {view === "tracking" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Search Input Bar */}
            <div className="p-4 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[260px]">
                  <span className="font-mono text-xs uppercase text-[#64748b] block">MASUKKAN NOMOR NOTA PESANAN</span>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={orderSearchInput}
                      onChange={(e) => setOrderSearchInput(e.target.value)}
                      placeholder="Contoh: LDR-20261109-002"
                      className="flex-1 p-2 rounded-lg bg-[#f8f8f6] border border-[#cbd5e1] font-mono text-xs font-bold"
                    />
                    <button
                      onClick={() => {
                        setActiveOrderNo(orderSearchInput);
                        fetchTrackedOrder(orderSearchInput);
                      }}
                      className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Lacak</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Jika customer login, tampilkan daftar pesanan miliknya */}
              {user?.role === "customer" && myOrdersList.length > 0 && (
                <div className="pt-2 border-t border-[#e6e6e2]">
                  <span className="text-[11px] font-semibold text-[#0f172a] block mb-1">Riwayat Pesanan Saya:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {myOrdersList.map((myOrd) => (
                      <button
                        key={myOrd.id}
                        onClick={() => {
                          setOrderSearchInput(myOrd.order_no);
                          setActiveOrderNo(myOrd.order_no);
                          fetchTrackedOrder(myOrd.order_no);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                          activeOrderNo === myOrd.order_no
                            ? "bg-[#0f172a] text-white border-[#0f172a]"
                            : "bg-[#f8f8f6] text-[#475569] border-[#cbd5e1] hover:border-[#94a3b8]"
                        }`}
                      >
                        #{myOrd.order_no} ({myOrd.status}) — Rp {myOrd.total.toLocaleString("id-ID")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Jika customer login tapi belum ada pesanan */}
              {user?.role === "customer" && myOrdersList.length === 0 && (
                <div className="pt-2 border-t border-[#e6e6e2] text-xs text-[#64748b] flex items-center justify-between">
                  <span>Anda belum memiliki riwayat pesanan laundry.</span>
                  <button
                    onClick={() => setView("order")}
                    className="text-xs text-sky-600 hover:text-sky-700 font-semibold underline"
                  >
                    + Buat Pesanan Baru
                  </button>
                </div>
              )}
            </div>

            {/* Error or Loading */}
            {isLoadingTrack && (
              <div className="p-8 text-center font-mono text-xs text-[#64748b] bg-white rounded-xl border border-[#e2e2dc]">
                Mengambil manifest pesanan #{activeOrderNo} dari server...
              </div>
            )}

            {trackError && !isLoadingTrack && (
              <div className="p-6 text-center text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
                <AlertCircle className="w-5 h-5 mx-auto mb-2 text-rose-600" />
                <span>{trackError}</span>
              </div>
            )}

            {/* Order Manifest Card */}
            {trackedOrder && !isLoadingTrack && (
              <div className="p-6 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-6">
                {user?.role === "customer" && trackedOrder.customer.id !== user.id && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Perhatian: Anda sedang melacak nota publik <strong>#{trackedOrder.order_no}</strong> atas nama pelanggan lain (<strong>{trackedOrder.customer.name}</strong>).
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-[#f0f0ec] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#64748b]">MANIFEST PELACAKAN:</span>
                    <strong className="font-mono text-base text-[#0f172a]">#{trackedOrder.order_no}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchTrackedOrder(trackedOrder.order_no)}
                    className="btn-press px-3 py-1 rounded bg-[#f0f0ec] hover:bg-[#e2e2dc] text-xs font-mono flex items-center gap-1.5 text-[#0f172a]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Perbarui Lacak</span>
                  </button>
                </div>

                {/* Top Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] text-xs font-mono">
                  <div>
                    <span className="text-[#94a3b8] uppercase text-[10px] block">PELANGGAN</span>
                    <strong className="text-[#0f172a] text-xs block">{trackedOrder.customer.name}</strong>
                    <span className="text-[10px] text-[#64748b]">{trackedOrder.customer.phone}</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] uppercase text-[10px] block">WORKSHOP TUJUAN</span>
                    <strong className="text-[#0f172a] text-xs block">{trackedOrder.outlet.name}</strong>
                    <span className="text-[10px] text-[#64748b]">Buka s/d 21:00 WIB</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] uppercase text-[10px] block">KURIR PENUGASAN</span>
                    <strong className="text-[#0f172a] text-xs block">
                      {trackedOrder.deliveries[0]?.courier?.name || "Belum Ditugaskan"}
                    </strong>
                    <span className="text-[10px] text-[#64748b]">
                      {trackedOrder.deliveries[0]?.courier?.phone || "Armada Bandar Lampung"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] uppercase text-[10px] block">STATUS PEMBAYARAN</span>
                    <strong
                      className={`text-xs block ${
                        trackedOrder.payments.some((p) => p.status === "paid") ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {trackedOrder.payments.some((p) => p.status === "paid") ? "LUNAS (TERVERIFIKASI)" : "PENDING (BELUM LUNAS)"}
                    </strong>
                    <span className="text-[10px] font-bold text-[#0f172a]">
                      Rp {trackedOrder.total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* 8-Stage Progress Tracker */}
                <div className="space-y-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#64748b]">
                    TAHAPAN OPERASIONAL LAUNDRY
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2 text-center text-xs">
                    {ORDER_STEPS.map((s, idx) => {
                      const currentIdx = ORDER_STEPS.findIndex((st) => st.id === trackedOrder.status);
                      const isDone = idx <= currentIdx;
                      const isCurrent = s.id === trackedOrder.status;

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-semibold ${
                              isCurrent
                                ? "bg-[#0f172a] text-white ring-2 ring-[#0f172a]/20"
                                : isDone
                                ? "bg-[#e2e8f0] text-[#0f172a]"
                                : "bg-[#f1f1ee] text-[#94a3b8]"
                            }`}
                          >
                            {isDone ? "✓" : idx + 1}
                          </div>
                          <span className={`text-[11px] ${isCurrent ? "font-bold text-[#0f172a]" : "text-[#64748b]"}`}>
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items Breakdown Table */}
                <div className="space-y-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#64748b]">ITEM LAYANAN</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#f8f8f6] text-[#475569] border-b border-[#e6e6e2]">
                        <tr>
                          <th className="p-2.5">LAYANAN</th>
                          <th className="p-2.5">KUANTITAS</th>
                          <th className="p-2.5">HARGA SNAPSHOT</th>
                          <th className="p-2.5 text-right">SUBTOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0ec]">
                        {trackedOrder.items.map((it) => (
                          <tr key={it.id}>
                            <td className="p-2.5 font-sans font-medium text-[#0f172a]">{it.service.name}</td>
                            <td className="p-2.5">{it.quantity} {it.service.unit}</td>
                            <td className="p-2.5">Rp {it.unit_price.toLocaleString("id-ID")}</td>
                            <td className="p-2.5 text-right font-bold">Rp {it.subtotal.toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail Logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#e6e6e2]">
                  <div className="space-y-3">
                    <h4 className="font-mono text-xs uppercase tracking-wider text-[#0f172a]">
                      CATATAN AUDIT WORKSHOP (order_status_logs)
                    </h4>
                    <div className="space-y-2 text-xs">
                      {trackedOrder.status_logs.map((log) => (
                        <div key={log.id} className="p-3 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] space-y-1">
                          <div className="flex justify-between items-center font-mono text-[11px]">
                            <strong className="text-[#0f172a] uppercase">[{log.status}]</strong>
                            <span className="text-[#64748b]">
                              {new Date(log.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                            </span>
                          </div>
                          <p className="text-[#475569]">{log.note || "Perubahan status operasional"}</p>
                          <span className="font-mono text-[10px] text-[#94a3b8]">Oleh: {log.user.name} ({log.user.role})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Review & Feedback Section */}
                  <div className="p-4 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] space-y-3">
                    <h4 className="font-mono text-xs uppercase tracking-wider text-[#0f172a]">
                      ULASAN & KEPUASAN (reviews)
                    </h4>
                    {trackedOrder.review ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center text-amber-500 font-mono text-sm">
                          {"★".repeat(trackedOrder.review.rating)}{" "}
                          <span className="text-[#0f172a] text-xs font-semibold ml-2">
                            {trackedOrder.review.rating}.0 / 5.0
                          </span>
                        </div>
                        <p className="text-[#334155] italic leading-relaxed">"{trackedOrder.review.comment}"</p>
                        <span className="font-mono text-[10px] text-emerald-700 block">
                          ✓ Ulasan terverifikasi pelanggan aplikasi
                        </span>
                      </div>
                    ) : trackedOrder.status === "completed" ? (
                      <div className="space-y-2 text-xs">
                        <p className="text-[#475569]">Pesanan Anda telah selesai! Berikan rating pelayanan kami:</p>
                        <div className="flex items-center gap-1 text-amber-500 text-lg cursor-pointer">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              onClick={() => setReviewRating(star)}
                              className={star <= reviewRating ? "text-amber-500" : "text-gray-300"}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Ceritakan pengalaman mencuci Anda..."
                          className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                        />
                        <button
                          onClick={handleSubmitReview}
                          disabled={isSubmittingReview}
                          className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white font-semibold text-xs"
                        >
                          {isSubmittingReview ? "Mengirim..." : "Kirim Ulasan Bintang"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748b] leading-relaxed">
                        Pesanan sedang dalam proses pengerjaan workshop Kedaton. Formulir rating dan ulasan akan terbuka setelah pesanan dinyatakan selesai.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Empty State when no order tracked */}
            {!trackedOrder && !isLoadingTrack && !trackError && (
              <div className="p-8 text-center bg-white rounded-xl border border-[#e2e2dc] shadow-xs space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b]">
                  <Search className="w-6 h-6 text-[#94a3b8]" />
                </div>
                <h3 className="font-semibold text-sm text-[#0f172a]">
                  {user?.role === "customer"
                    ? myOrdersList.length === 0
                      ? "Belum Ada Pesanan Aktif"
                      : "Pilih Pesanan untuk Dilacak"
                    : "Lacak Status Nota Laundry"}
                </h3>
                <p className="text-xs text-[#64748b] max-w-md mx-auto">
                  {user?.role === "customer"
                    ? myOrdersList.length === 0
                      ? "Akun Anda saat ini belum memiliki pesanan aktif. Silakan buat pesanan baru melalui menu 'Pesan Laundry'!"
                      : "Klik salah satu nomor nota Anda pada riwayat di atas untuk melihat detail progres pengerjaan."
                    : "Ketik nomor nota pesanan pada kolom pencarian di atas lalu klik Lacak untuk melihat manifest pengerjaan."}
                </p>
                {user?.role === "customer" && myOrdersList.length === 0 && (
                  <button
                    onClick={() => setView("order")}
                    className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>Pesan Laundry Sekarang</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: KASIR POS & THERMAL RECEIPT (Khusus Kasir / Admin) */}
        {view === "kasir" && (isKasir || isAdmin) && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-1">
                <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider">TERMINAL KASIR OUTLET KEDATON</span>
                <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                  Point of Sales & Penimbangan
                </h2>
              </div>

              {/* Special Feature PRD #1: Penimbangan Ulang */}
              <div className="p-5 rounded-xl bg-white border border-[#0f172a] shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#e6e6e2] pb-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0f172a]">
                    <Scale className="w-4 h-4" />
                    <span>PENIMBANGAN ULANG BERAT AKTUAL (PRD WORKFLOW #1)</span>
                  </div>
                  <span className="font-mono text-[10px] bg-[#f0f0ec] px-2 py-0.5 rounded text-[#475569]">
                    KASIR DESK
                  </span>
                </div>

                <p className="text-xs text-[#475569] leading-relaxed">
                  Pakaian yang dijemput kurir dari pesanan online masuk ke outlet Kedaton untuk ditimbang aktual. Sistem menghitung ulang total harga dan memicu WhatsApp otomatis ke pelanggan.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#64748b] mb-1 block">Pilih Pesanan Kiloan:</label>
                    <select
                      value={kasirSelectedOrder?.id || ""}
                      onChange={(e) => {
                        const sel = kasirOrders.find((o) => o.id === Number(e.target.value));
                        setKasirSelectedOrder(sel || null);
                        if (sel && sel.items[0]) setKasirActualWeight(sel.items[0].quantity);
                      }}
                      className="w-full p-2.5 rounded-lg bg-[#f8f8f6] border border-[#cbd5e1] font-mono text-xs font-semibold"
                    >
                      {kasirOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          #{o.order_no} — {o.customer.name} ({o.items[0]?.service.name || "Kiloan"}) — Status: {o.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#64748b] mb-1 block">Berat Timbangan Aktual (kg):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={kasirActualWeight}
                        onChange={(e) => setKasirActualWeight(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 rounded-lg bg-white border border-[#0f172a] font-mono font-bold text-center text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#64748b] mb-1 block">Catatan Penimbangan:</label>
                      <input
                        type="text"
                        value={kasirReweighNote}
                        onChange={(e) => setKasirReweighNote(e.target.value)}
                        placeholder="Kondisi kotor normal / noda kopi"
                        className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReweighSubmit}
                    disabled={isReweighing || !kasirSelectedOrder}
                    className="btn-press w-full py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:bg-[#94a3b8] text-white font-semibold text-xs transition-all"
                  >
                    {isReweighing ? "Memperbarui..." : "Simpan Berat Aktual & Kirim Notifikasi WhatsApp"}
                  </button>
                </div>
              </div>

              {/* Form Input Walk-in Cepat */}
              <div className="p-5 rounded-xl bg-white border border-[#e2e2dc] space-y-4">
                <div className="flex items-center justify-between border-b border-[#e6e6e2] pb-2">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[#0f172a]">
                    INPUT PELANGGAN WALK-IN / OUTLET KEDATON
                  </h4>
                  <span className="font-mono text-[10px] text-[#64748b]">Guest Supported</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#64748b] mb-1 block">Nama Pelanggan:</label>
                    <input
                      type="text"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#64748b] mb-1 block">Nomor WhatsApp:</label>
                    <input
                      type="text"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#64748b] mb-1 block">Pilihan Layanan:</label>
                    <select
                      value={walkInServiceId}
                      onChange={(e) => setWalkInServiceId(Number(e.target.value))}
                      className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Rp {s.price.toLocaleString("id-ID")}/{s.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#64748b] mb-1 block">Berat Timbangan (kg):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={walkInQty}
                      onChange={(e) => setWalkInQty(parseFloat(e.target.value) || 1)}
                      className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#f8f8f6] border border-[#e6e6e2] text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="payCash"
                      checked={walkInPayCash}
                      onChange={(e) => setWalkInPayCash(e.target.checked)}
                      className="accent-[#0f172a]"
                    />
                    <label htmlFor="payCash" className="cursor-pointer font-medium">Bayar Tunai Sekarang (Lunas)</label>
                  </div>
                  <button
                    type="button"
                    onClick={handleWalkInOrder}
                    className="btn-press px-4 py-2 rounded-lg bg-[#0f172a] text-white font-semibold text-xs"
                  >
                    Simpan & Cetak Struk
                  </button>
                </div>
              </div>
            </div>

            {/* Thermal Receipt Lampung */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-[#64748b]">
                  PRATINJAU STRUK FISIK (80MM)
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-press px-3 py-1.5 rounded-md bg-white border border-[#cbd5e1] hover:bg-[#f4f4f0] text-xs font-mono font-semibold flex items-center gap-1.5 text-[#0f172a]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Nota</span>
                </button>
              </div>

              {/* Thermal paper container */}
              <div
                id="thermal-receipt"
                className="p-6 bg-white border border-[#d4d4ce] rounded-xl shadow-xs font-mono text-xs text-[#111827] space-y-3 max-w-sm mx-auto"
              >
                {/* Header */}
                <div className="text-center space-y-0.5 border-b border-dashed border-[#94a3b8] pb-3">
                  <h3 className="font-bold text-sm tracking-wider uppercase">LAUNDRYHUB</h3>
                  <p className="text-[11px] text-[#64748b]">Jl. Teuku Umar No. 88, Kedaton (Dekat MBK)</p>
                  <p className="text-[11px] text-[#64748b]">Telp / WhatsApp: 0812-7788-9901</p>
                </div>

                {/* Metadata */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-[#94a3b8] pb-2">
                  <div className="flex justify-between">
                    <span>No. Nota:</span>
                    <strong className="text-[#0f172a]">{kasirSelectedOrder?.order_no || "LDR-20261110-003"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date().toLocaleDateString("id-ID")} {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{user?.name || "Siti Rahma (Kedaton)"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Klien:</span>
                    <strong>{kasirSelectedOrder?.customer.name || walkInName}</strong>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-[#94a3b8] pb-2">
                  <div className="flex justify-between">
                    <span>{kasirSelectedOrder?.items[0]?.service.name || "Cuci + Setrika Reguler"}</span>
                    <span>Rp {(kasirSelectedOrder?.total || 33600).toLocaleString("id-ID")}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-[#94a3b8] pb-2">
                  <div className="flex justify-between font-bold text-xs pt-1">
                    <span>TOTAL:</span>
                    <span>Rp {(kasirSelectedOrder?.total || 33600).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#64748b]">
                    <span>Metode:</span>
                    <span>TUNAI (Lunas di Kasir Kedaton)</span>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-center text-[10px] text-[#64748b] pt-1 space-y-0.5">
                  <p>Harap tunjukkan nota saat pengambilan di outlet.</p>
                  <p className="font-bold text-[#0f172a]">laundryhub.id/lampung</p>
                </div>
              </div>
            </div>
          </div>

          {/* WORKSHOP QUEUE & PIPELINE CONTROL (Kasir Kedaton Operasional) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-[#e2e2dc] shadow-xs">
              <div>
                <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider block">KONTROL ALUR OPERASIONAL WORKSHOP</span>
                <h3 className="text-lg font-semibold text-[#0f172a]">
                  Antrean & Status Pengerjaan Cucian Kedaton
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadKasirData}
                  className="btn-press px-3 py-1.5 rounded-lg bg-[#f0f0ec] hover:bg-[#e2e2dc] text-xs font-mono flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Antrean</span>
                </button>
              </div>
            </div>

            {kasirOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748b] bg-white rounded-xl border border-[#e2e2dc]">
                Belum ada pesanan aktif di antrean workshop saat ini.
              </div>
            ) : (
              <div className="space-y-3">
                {kasirOrders.map((ord) => {
                  const isPaid = ord.payments && ord.payments.some((p) => p.status === "paid");
                  const isWalkIn = ord.fulfillment_type === "drop_off";

                  return (
                    <div
                      key={ord.id}
                      className={`p-4 rounded-xl bg-white border transition-all space-y-3 ${
                        kasirSelectedOrder?.id === ord.id
                          ? "border-[#0f172a] shadow-xs ring-1 ring-[#0f172a]/20"
                          : "border-[#e2e2dc] hover:border-[#cbd5e1]"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0ec] pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#0f172a]">#{ord.order_no}</span>
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                              isWalkIn
                                ? "bg-slate-100 text-slate-700 border border-slate-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {isWalkIn ? "🏬 Walk-in / Drop-off" : "📦 Antar-Jemput"}
                          </span>
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                              ord.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : ord.status === "ready"
                                ? "bg-blue-100 text-blue-800"
                                : ord.status === "washing" || ord.status === "ironing"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            Status: {STATUS_LABELS[ord.status] || ord.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPaid ? (
                            <span className="font-mono text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Lunas ({ord.payments?.[0]?.method.toUpperCase() || "CASH"})</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCashPayment(ord.id, ord.total)}
                              className="btn-press px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-mono text-[11px] font-semibold flex items-center gap-1"
                            >
                              <span>💵 Terima Tunai Rp {ord.total.toLocaleString("id-ID")}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#334155]">
                        <div>
                          <span className="text-[#94a3b8] uppercase text-[10px] block">PELANGGAN</span>
                          <strong className="text-[#0f172a]">{ord.customer.name}</strong>
                          <span className="text-[11px] text-[#64748b] block font-mono">{ord.customer.phone}</span>
                        </div>

                        <div>
                          <span className="text-[#94a3b8] uppercase text-[10px] block">ITEM & BERAT</span>
                          <span className="text-[#0f172a] font-semibold">
                            {ord.items.map((i) => `${i.service.name} (${i.quantity} ${i.service.unit})`).join(", ")}
                          </span>
                          <span className="text-[11px] font-mono text-[#0f172a] block font-bold mt-0.5">
                            Total: Rp {ord.total.toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div>
                          <span className="text-[#94a3b8] uppercase text-[10px] block">CATATAN / WORKSHOP</span>
                          <span className="text-[11px] text-[#475569] block">
                            {ord.notes || "Tidak ada catatan khusus"}
                          </span>
                          <span className="text-[10px] text-[#94a3b8] font-mono block mt-0.5">
                            {new Date(ord.created_at).toLocaleDateString("id-ID")} {new Date(ord.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                          </span>
                        </div>
                      </div>

                      {/* Pipeline Stage Buttons */}
                      <div className="pt-2 border-t border-[#f0f0ec] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-[#64748b] uppercase mr-1">Proses Alur:</span>

                          {ord.status === "pending" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, "received", "Cucian diterima di kasir workshop Kedaton")}
                              className="btn-press px-2.5 py-1 rounded bg-[#0f172a] text-white text-xs font-semibold"
                            >
                              📥 Terima di Outlet
                            </button>
                          )}

                          {ord.status === "picked_up" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, "received", "Cucian tiba dari kurir dan diterima di outlet")}
                              className="btn-press px-2.5 py-1 rounded bg-blue-700 text-white text-xs font-semibold"
                            >
                              📥 Konfirmasi Tiba di Outlet
                            </button>
                          )}

                          {ord.status === "received" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, "washing", "Pencucian mesin dimulai oleh tim workshop")}
                              className="btn-press px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                            >
                              🧼 Mulai Cuci (Washing)
                            </button>
                          )}

                          {ord.status === "washing" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, "ironing", "Pencucian selesai, masuk proses setrika uap & QC")}
                              className="btn-press px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                            >
                              💨 Mulai Setrika (Ironing)
                            </button>
                          )}

                          {ord.status === "ironing" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, "ready", "Pakaian selesai disetrika, dipacking rapi & siap")}
                              className="btn-press px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                            >
                              ✨ Selesai & Siap (Ready)
                            </button>
                          )}

                          {ord.status === "ready" && (
                            <>
                              {isWalkIn ? (
                                <button
                                  onClick={() => handleUpdateOrderStatus(ord.id, "completed", "Pesanan diserahkan langsung ke pelanggan di outlet")}
                                  className="btn-press px-2.5 py-1 rounded bg-emerald-800 text-white text-xs font-semibold"
                                >
                                  ✅ Serahkan ke Pelanggan (Selesai)
                                </button>
                              ) : (
                                <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  🚚 Tugas Antar Siap di Kurir
                                </span>
                              )}
                            </>
                          )}

                          {ord.status === "delivering" && (
                            <span className="font-mono text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🛵 Kurir sedang mengantar ke alamat
                            </span>
                          )}

                          {ord.status === "completed" && (
                            <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Pesanan Selesai
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setKasirSelectedOrder(ord);
                              if (ord.items[0]) setKasirActualWeight(ord.items[0].quantity);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="btn-press px-2 py-1 rounded border border-[#cbd5e1] hover:bg-[#f0f0ec] text-[11px] font-mono"
                          >
                            ⚖ Timbang Ulang
                          </button>
                          <button
                            onClick={() => {
                              setKasirSelectedOrder(ord);
                              window.scrollTo({ top: 300, behavior: "smooth" });
                            }}
                            className="btn-press px-2 py-1 rounded border border-[#cbd5e1] hover:bg-[#f0f0ec] text-[11px] font-mono"
                          >
                            🖨️ Struk
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

        {/* VIEW 5: OPERASIONAL ADMIN CONSOLE (Khusus Super Admin) */}
        {view === "admin" && isAdmin && (
          <div className="space-y-8">
            <div className="space-y-1">
              <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider">PANEL KONTROL REGIONAL LAMPUNG</span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                Ringkasan Workshop Kedaton & Way Halim
              </h2>
            </div>

            {/* Metrics Row from Live Reports API */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-1">
                <span className="font-mono text-xs text-[#64748b] uppercase block">PENDAPATAN BULAN INI</span>
                <p className="text-2xl font-bold font-mono text-[#0f172a]">
                  Rp {(adminReport?.revenue?.total || 155700).toLocaleString("id-ID")}
                </p>
                <span className="text-[11px] text-[#64748b] block font-mono">
                  {adminReport?.revenue?.order_count || 3} transaksi tercatat
                </span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-1">
                <span className="font-mono text-xs text-[#64748b] uppercase block">PESANAN TERDAFTAR</span>
                <p className="text-2xl font-bold font-mono text-[#0f172a]">{adminOrders.length || 4}</p>
                <span className="text-[11px] text-[#64748b] block font-mono">Pusat Kedaton & Way Halim</span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-1">
                <span className="font-mono text-xs text-[#64748b] uppercase block">TOTAL PELANGGAN</span>
                <p className="text-2xl font-bold font-mono text-[#0f172a]">{adminReport?.customers?.total || 5}</p>
                <span className="text-[11px] text-[#64748b] block font-mono">Rajabasa, Way Halim, Kedaton</span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-1">
                <span className="font-mono text-xs text-[#64748b] uppercase block">KEPUASAN PELANGGAN</span>
                <p className="text-2xl font-bold font-mono text-[#0f172a]">
                  {adminReport?.reviews?.average_rating || 5.0} <span className="text-sm font-normal text-[#94a3b8]">/5</span>
                </p>
                <span className="text-[11px] text-[#64748b] block font-mono">
                  {adminReport?.reviews?.total_reviews || 1} ulasan terverifikasi
                </span>
              </div>
            </div>

            {/* Table Manajemen Pesanan & Transisi Status */}
            <div className="p-6 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-[#0f172a]">
                    Matriks Pengawasan Pesanan & Transisi Status
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    Update status pengerjaan secara langsung untuk mencatat audit log dan mengirim WhatsApp otomatis.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#f8f8f6] text-[#475569] font-mono border-b border-[#e6e6e2]">
                    <tr>
                      <th className="p-3">NO. ORDER</th>
                      <th className="p-3">PELANGGAN</th>
                      <th className="p-3">OUTLET</th>
                      <th className="p-3">TOTAL</th>
                      <th className="p-3">STATUS AKTIF</th>
                      <th className="p-3">UBAH STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0ec]">
                    {adminOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="p-3 font-mono font-bold text-[#0f172a]">#{ord.order_no}</td>
                        <td className="p-3">{ord.customer.name} ({ord.customer.phone})</td>
                        <td className="p-3">{ord.outlet.name}</td>
                        <td className="p-3 font-mono font-bold">Rp {ord.total.toLocaleString("id-ID")}</td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={ord.status}
                            onChange={async (e) => {
                              const newSt = e.target.value;
                              await fetch(`/api/orders/${ord.id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: newSt, note: `Diubah oleh Admin melalui konsol` }),
                              });
                              loadAdminData();
                            }}
                            className="p-1 rounded bg-[#f8f8f6] border border-[#cbd5e1] font-mono text-xs"
                          >
                            {ORDER_STEPS.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.label} ({st.id})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: KURIR DISPATCH TASK VIEW (Khusus Kurir / Admin) */}
        {view === "kurir" && (isKurir || isAdmin) && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#e2e2dc] shadow-xs">
              <div>
                <span className="font-mono text-xs text-[#64748b] uppercase tracking-wider block">ARMADA MOTOR KURIR LAMPUNG (PLAT BE)</span>
                <h2 className="text-xl font-semibold text-[#0f172a]">
                  Daftar Tugas Penjemputan & Pengantaran
                </h2>
              </div>
              <button
                onClick={loadCourierTasks}
                className="btn-press px-3 py-1.5 rounded-lg bg-[#f0f0ec] hover:bg-[#e2e2dc] text-xs font-mono flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Tugas</span>
              </button>
            </div>

            {isLoadingCourier && (
              <div className="p-8 text-center font-mono text-xs text-[#64748b] bg-white rounded-xl border border-[#e2e2dc]">
                Mengambil daftar tugas kurir...
              </div>
            )}

            {!isLoadingCourier && courierTasks.length === 0 && (
              <div className="p-8 text-center text-xs text-[#64748b] bg-white rounded-xl border border-[#e2e2dc]">
                Tidak ada tugas penjemputan atau pengantaran aktif saat ini.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courierTasks.map((task) => (
                <div key={task.id} className="p-5 rounded-xl bg-white border border-[#e2e2dc] shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#e6e6e2] pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                          task.type === "pickup"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        {task.type === "pickup" ? "📦 JEMPUT (PICKUP)" : "🚚 ANTAR (DELIVERY)"}
                      </span>
                      {!task.courier_id ? (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                          ⚠️ Terbuka (Belum Ada Kurir)
                        </span>
                      ) : task.courier_id === user?.id ? (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                          ✓ Tugas Anda
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          Kurir: {task.courier?.name || "Lain"}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-[#64748b] font-bold">
                      #{task.order.order_no}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[#94a3b8] uppercase text-[10px] block">PELANGGAN</span>
                      <strong className="text-[#0f172a] text-sm block">{task.order.customer.name}</strong>
                      <a
                        href={`https://wa.me/${task.order.customer.phone.replace(/^0/, "62")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 font-mono text-[11px] hover:underline mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        <span>WA: {task.order.customer.phone}</span>
                      </a>
                    </div>

                    <div>
                      <span className="text-[#94a3b8] uppercase text-[10px] block">ALAMAT LOKASI</span>
                      <p className="text-[#334155] leading-relaxed mt-0.5">
                        {task.address ? `${task.address.label} — ${task.address.full_address}` : "Alamat Bandar Lampung"}
                      </p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#e6e6e2] font-mono text-[11px]">
                      <span className="text-[#64748b]">Jadwal: {new Date(task.scheduled_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                      <span
                        className={`font-bold uppercase ${
                          task.status === "done"
                            ? "text-emerald-700"
                            : task.status === "on_the_way"
                            ? "text-blue-700"
                            : "text-amber-700"
                        }`}
                      >
                        [{task.status}]
                      </span>
                    </div>
                  </div>

                  {/* Actions for Courier */}
                  <div className="pt-2 flex items-center gap-2">
                    {task.status === "scheduled" && (
                      <button
                        onClick={() => handleUpdateDeliveryStatus(task.id, "on_the_way")}
                        className="btn-press flex-1 py-2 rounded-lg bg-[#0f172a] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{!task.courier_id ? "✋ Ambil & Mulai Tugas" : "Mulai Menuju Lokasi"}</span>
                      </button>
                    )}

                    {task.status === "on_the_way" && (
                      <button
                        onClick={() => handleUpdateDeliveryStatus(task.id, "done")}
                        className="btn-press flex-1 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tandai Serah Terima Selesai</span>
                      </button>
                    )}

                    {task.status === "done" && (
                      <span className="w-full py-1.5 text-center font-mono text-xs text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
                        ✓ Tugas Selesai Dikerjakan
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* AUTH MODAL (LOGIN & REGISTER)                                  */}
      {/* ============================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#e2e2dc] shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#e6e6e2] pb-3">
              <h3 className="font-semibold text-sm text-[#0f172a]">
                {authTab === "login" ? "Masuk ke LaundryHub" : "Pendaftaran Akun Baru"}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-[#64748b] hover:text-[#0f172a] text-xs font-mono font-bold"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {authError}
              </div>
            )}

            {authTab === "login" ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthError(null);
                  setMyOrdersList([]);
                  setTrackedOrder(null);
                  setActiveOrderNo("");
                  setOrderSearchInput("");
                  setKasirOrders([]);
                  setCourierTasks([]);
                  setAdminReport(null);
                  const res = await login(authIdentifier, authPassword);
                  if (res.ok) {
                    setShowAuthModal(false);
                  } else {
                    setAuthError(res.error || "Login gagal.");
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#64748b]">ID Pengguna / No. WhatsApp / Email:</label>
                    <span className="text-[10px] text-[#94a3b8] font-mono">Staff: admin / kasir / kurir</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={authIdentifier}
                    onChange={(e) => setAuthIdentifier(e.target.value)}
                    placeholder="admin / kasir / kurir / 081234567890"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#64748b] block mb-1">Password:</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-press w-full py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold text-xs transition-all"
                >
                  Masuk Sekarang
                </button>
                <p className="text-center text-[11px] text-[#64748b]">
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("register");
                      setAuthError(null);
                    }}
                    className="font-semibold text-[#0f172a] hover:underline"
                  >
                    Daftar di sini
                  </button>
                </p>
              </form>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthError(null);
                  const res = await register(authName, authPhone, authEmail, authPassword);
                  if (res.ok) {
                    setShowAuthModal(false);
                  } else {
                    setAuthError(res.error || "Registrasi gagal.");
                  }
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="text-[11px] text-[#64748b] block mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Ahmad Fauzi"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#64748b] block mb-1">Nomor WhatsApp (Aktif):</label>
                  <input
                    type="text"
                    required
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="081277889900"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#64748b] block mb-1">Email (Opsional):</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ahmad@gmail.com"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#64748b] block mb-1">Password:</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2 rounded-lg bg-white border border-[#cbd5e1]"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-press w-full py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold text-xs transition-all"
                >
                  Daftar Akun Baru
                </button>
                <p className="text-center text-[11px] text-[#64748b]">
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("login");
                      setAuthError(null);
                    }}
                    className="font-semibold text-[#0f172a] hover:underline"
                  >
                    Masuk
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
