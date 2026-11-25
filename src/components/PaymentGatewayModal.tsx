"use client";

import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Building2,
  Wallet,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: number;
    order_no: string;
    total: number;
    customer?: { name: string; phone: string };
    outlet?: { name: string };
    items?: { quantity: number; service?: { name: string } }[];
  } | null;
  onPaymentSuccess: () => void;
  token?: string | null;
}

interface ChargeData {
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
  expired_at: string;
  instructions: { title: string; steps: string[] }[];
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export default function PaymentGatewayModal({
  isOpen,
  onClose,
  order,
  onPaymentSuccess,
  token,
}: PaymentGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<"qris" | "bank_transfer" | "ewallet">("qris");
  const [selectedBank, setSelectedBank] = useState<"bca" | "mandiri" | "bni" | "bri">("bca");
  const [selectedEwallet, setSelectedEwallet] = useState<"gopay" | "ovo" | "shopeepay" | "dana">("gopay");
  const [chargeData, setChargeData] = useState<ChargeData | null>(null);
  const [isLoadingCharge, setIsLoadingCharge] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccessPaid, setIsSuccessPaid] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 mins in seconds
  const [isLoadingSnap, setIsLoadingSnap] = useState(false);
  const [midtransNotice, setMidtransNotice] = useState<string | null>(null);

  // Initialize charge when tab/bank/wallet changes
  const initCharge = useCallback(
    async (method: "qris" | "bank_transfer" | "ewallet", bankVal?: string, walletVal?: string) => {
      if (!order?.id) return;
      setIsLoadingCharge(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/payments/charge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            order_id: order.id,
            method,
            bank: bankVal || selectedBank,
            ewallet_channel: walletVal || selectedEwallet,
          }),
        });

        const data = await res.json();
        if (data.success && data.data) {
          setChargeData(data.data);
        } else {
          setErrorMsg(data.error || "Gagal menginisialisasi pembayaran gateway.");
        }
      } catch {
        setErrorMsg("Koneksi gateway terputus. Silakan coba kembali.");
      } finally {
        setIsLoadingCharge(false);
      }
    },
    [order?.id, selectedBank, selectedEwallet, token]
  );

  useEffect(() => {
    if (isOpen && order) {
      setIsSuccessPaid(false);
      setTimeLeft(15 * 60);
      initCharge(activeTab);
    }
  }, [isOpen, order?.id, activeTab, initCharge]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || isSuccessPaid || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isSuccessPaid, timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Simulate or verify payment
  const handleVerifyPayment = async () => {
    if (!order?.id) return;
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_id: order.id,
          payment_id: chargeData?.payment_id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccessPaid(true);
        setTimeout(() => {
          onPaymentSuccess();
        }, 1200);
      } else {
        setErrorMsg(data.error || "Verifikasi pembayaran gagal.");
      }
    } catch {
      setErrorMsg("Koneksi gagal saat memverifikasi pembayaran.");
    } finally {
      setIsVerifying(false);
    }
  };

  const loadMidtransScript = (clientKey: string, isSandbox: boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.snap) {
        resolve(true);
        return;
      }
      const existingScript = document.getElementById("midtrans-snap-script");
      if (existingScript) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.id = "midtrans-snap-script";
      script.src = isSandbox
        ? "https://app.sandbox.midtrans.com/snap/snap.js"
        : "https://app.midtrans.com/snap/snap.js";
      script.setAttribute("data-client-key", clientKey);
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayWithMidtrans = async () => {
    if (!order?.id) return;
    setIsLoadingSnap(true);
    setMidtransNotice(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/payments/snap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id }),
      });

      const resData = await res.json();

      if (!resData.success) {
        if (resData.error === "MIDTRANS_NOT_CONFIGURED") {
          setMidtransNotice(
            "Kunci Midtrans belum aktif di .env. Anda dapat mengisi MIDTRANS_SERVER_KEY atau memakai Simulator QRIS / VA langsung di bawah ini!"
          );
        } else {
          setErrorMsg(resData.error || "Gagal membuka popup Midtrans.");
        }
        setIsLoadingSnap(false);
        return;
      }

      const { token: snapToken, client_key, is_sandbox, redirect_url } = resData.data;

      const scriptLoaded = await loadMidtransScript(client_key, is_sandbox);

      if (scriptLoaded && window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: () => {
            setIsSuccessPaid(true);
            setTimeout(() => {
              onPaymentSuccess();
            }, 1200);
          },
          onPending: () => {
            alert("Pembayaran berstatus pending. Silakan selesaikan pembayaran sesuai petunjuk di layar.");
          },
          onError: () => {
            setErrorMsg("Pembayaran Midtrans gagal atau dibatalkan.");
          },
          onClose: () => {
            // Popup closed by customer
          },
        });
      } else if (redirect_url) {
        window.open(redirect_url, "_blank");
      }
    } catch {
      setErrorMsg("Koneksi ke server gateway Midtrans terputus.");
    } finally {
      setIsLoadingSnap(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                PAYMENT GATEWAY
              </span>
              <span className="font-mono text-xs text-slate-300">#{order.order_no}</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>LaundryHub Pay</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {!isSuccessPaid && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">BATAS WAKTU</span>
                <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1 justify-end">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimer(timeLeft)}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Price Bar */}
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-5 py-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748b] block">Total Pembayaran Tagihan:</span>
            <strong className="text-lg font-bold text-[#0f172a] font-mono">
              Rp {order.total.toLocaleString("id-ID")}
            </strong>
          </div>
          <div className="text-right text-[11px] text-[#64748b]">
            <span className="block">{order.outlet?.name || "Outlet Kedaton"}</span>
            <span className="font-semibold text-emerald-700">Terverifikasi Otomatis</span>
          </div>
        </div>

        {/* Midtrans Snap Official CTA */}
        {!isSuccessPaid && (
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#334155]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-white">Midtrans Snap Gateway</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-300 font-mono border border-sky-400/30">
                    Resmi Pop-up
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Bayar via QRIS GoPay, BCA, Mandiri, BRI, BNI & Indomaret dalam satu pop-up
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePayWithMidtrans}
              disabled={isLoadingSnap}
              className="btn-press w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shrink-0 cursor-pointer"
            >
              {isLoadingSnap ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghubungkan Midtrans...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Pop-up Midtrans</span>
                </>
              )}
            </button>
          </div>
        )}

        {midtransNotice && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Mode Simulasi Mandiri Aktif</strong>
              <span>{midtransNotice}</span>
            </div>
          </div>
        )}

        {/* Main Body */}
        {isSuccessPaid ? (
          // Success Screen
          <div className="p-8 sm:p-10 text-center space-y-5 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-[#0f172a]">Pembayaran Berhasil!</h4>
              <p className="text-xs text-[#64748b]">
                Transaksi Anda telah diverifikasi oleh Payment Gateway LaundryHub.
              </p>
            </div>

            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl max-w-sm mx-auto text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-[#64748b]">ID Transaksi:</span>
                <span className="font-bold text-[#0f172a]">{chargeData?.gateway_ref || "GW-SUCCESS"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Metode:</span>
                <span className="font-bold text-emerald-700">{chargeData?.channel_name || "QRIS / VA"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Total Bayar:</span>
                <span className="font-bold text-[#0f172a]">Rp {order.total.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Status:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  LUNAS (SETTLED)
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onPaymentSuccess();
              }}
              className="btn-press px-6 py-2.5 rounded-xl bg-[#0f172a] text-white font-semibold text-xs inline-flex items-center gap-2"
            >
              <span>Kembali ke Pelacakan Pesanan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Tabs */}
            <div className="grid grid-cols-3 border-b border-[#e2e8f0] bg-slate-50 text-xs font-semibold">
              <button
                onClick={() => {
                  setActiveTab("qris");
                  initCharge("qris");
                }}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeTab === "qris"
                    ? "border-[#0f172a] text-[#0f172a] bg-white font-bold"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                <QrCode className="w-4 h-4 text-rose-600" />
                <span>QRIS Instant</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("bank_transfer");
                  initCharge("bank_transfer", selectedBank);
                }}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeTab === "bank_transfer"
                    ? "border-[#0f172a] text-[#0f172a] bg-white font-bold"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Virtual Account</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("ewallet");
                  initCharge("ewallet", undefined, selectedEwallet);
                }}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeTab === "ewallet"
                    ? "border-[#0f172a] text-[#0f172a] bg-white font-bold"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>E-Wallet</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="m-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Content Tabs */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* TAB 1: QRIS */}
              {activeTab === "qris" && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
                    {/* Visual QR Code Display */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-md flex flex-col items-center max-w-[240px] text-center">
                      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="font-extrabold text-[12px] tracking-widest text-slate-900">QRIS</span>
                        <span className="text-[9px] font-bold text-rose-600 px-1.5 py-0.5 bg-rose-50 rounded">
                          GPN
                        </span>
                      </div>

                      {/* Generated SVG QR Code Graphic */}
                      <div className="relative p-2 bg-white rounded-lg">
                        <svg className="w-44 h-44" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                          {/* Corner markers */}
                          <rect x="10" y="10" width="50" height="50" rx="4" fill="#0f172a" />
                          <rect x="20" y="20" width="30" height="30" rx="2" fill="white" />
                          <rect x="26" y="26" width="18" height="18" rx="1" fill="#0f172a" />

                          <rect x="140" y="10" width="50" height="50" rx="4" fill="#0f172a" />
                          <rect x="150" y="20" width="30" height="30" rx="2" fill="white" />
                          <rect x="156" y="26" width="18" height="18" rx="1" fill="#0f172a" />

                          <rect x="10" y="140" width="50" height="50" rx="4" fill="#0f172a" />
                          <rect x="20" y="150" width="30" height="30" rx="2" fill="white" />
                          <rect x="26" y="156" width="18" height="18" rx="1" fill="#0f172a" />

                          {/* Data patterns */}
                          <rect x="70" y="15" width="8" height="8" fill="#0f172a" />
                          <rect x="85" y="15" width="14" height="8" fill="#0f172a" />
                          <rect x="110" y="15" width="8" height="8" fill="#0f172a" />
                          <rect x="125" y="15" width="8" height="8" fill="#0f172a" />

                          <rect x="70" y="30" width="18" height="8" fill="#0f172a" />
                          <rect x="95" y="30" width="8" height="8" fill="#0f172a" />
                          <rect x="115" y="30" width="18" height="8" fill="#0f172a" />

                          <rect x="70" y="45" width="8" height="18" fill="#0f172a" />
                          <rect x="85" y="45" width="25" height="8" fill="#0f172a" />
                          <rect x="120" y="45" width="12" height="18" fill="#0f172a" />

                          {/* Center grid */}
                          <rect x="15" y="70" width="8" height="18" fill="#0f172a" />
                          <rect x="30" y="70" width="22" height="8" fill="#0f172a" />
                          <rect x="60" y="70" width="12" height="12" fill="#0f172a" />
                          <rect x="80" y="65" width="40" height="40" rx="6" fill="#0f172a" />
                          {/* Inner icon */}
                          <circle cx="100" cy="85" r="12" fill="white" />
                          <path d="M96 85L99 88L105 82" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                          <rect x="130" y="70" width="15" height="8" fill="#0f172a" />
                          <rect x="155" y="70" width="8" height="20" fill="#0f172a" />
                          <rect x="175" y="70" width="15" height="12" fill="#0f172a" />

                          <rect x="15" y="95" width="20" height="8" fill="#0f172a" />
                          <rect x="45" y="90" width="10" height="20" fill="#0f172a" />
                          <rect x="65" y="95" width="8" height="18" fill="#0f172a" />

                          <rect x="130" y="90" width="8" height="25" fill="#0f172a" />
                          <rect x="145" y="95" width="22" height="8" fill="#0f172a" />
                          <rect x="175" y="90" width="12" height="25" fill="#0f172a" />

                          <rect x="15" y="115" width="12" height="15" fill="#0f172a" />
                          <rect x="35" y="120" width="25" height="8" fill="#0f172a" />
                          <rect x="70" y="115" width="15" height="8" fill="#0f172a" />
                          <rect x="95" y="115" width="22" height="8" fill="#0f172a" />
                          <rect x="125" y="120" width="18" height="8" fill="#0f172a" />
                          <rect x="150" y="115" width="12" height="15" fill="#0f172a" />

                          {/* Bottom patterns */}
                          <rect x="70" y="140" width="14" height="12" fill="#0f172a" />
                          <rect x="90" y="140" width="8" height="25" fill="#0f172a" />
                          <rect x="105" y="140" width="20" height="8" fill="#0f172a" />
                          <rect x="135" y="140" width="10" height="18" fill="#0f172a" />
                          <rect x="155" y="140" width="30" height="8" fill="#0f172a" />

                          <rect x="70" y="160" width="12" height="20" fill="#0f172a" />
                          <rect x="90" y="170" width="25" height="10" fill="#0f172a" />
                          <rect x="125" y="155" width="18" height="12" fill="#0f172a" />
                          <rect x="150" y="160" width="15" height="20" fill="#0f172a" />
                          <rect x="175" y="165" width="12" height="15" fill="#0f172a" />
                        </svg>
                      </div>

                      <span className="font-semibold text-[11px] text-[#0f172a] mt-1">LaundryHub Kedaton</span>
                      <span className="font-mono text-[9px] text-[#64748b]">NMID: ID102026112399</span>
                    </div>

                    {/* QRIS Instructions & Details */}
                    <div className="space-y-3 flex-1 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">DAPAT DIGUNAKAN UNTUK:</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {["BCA Mobile", "Livin' Mandiri", "BRImo", "BNI Mobile", "GoPay", "OVO", "DANA", "ShopeePay"].map(
                            (app) => (
                              <span
                                key={app}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-700"
                              >
                                {app}
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-slate-600 text-[11px]">
                        <p className="flex items-start gap-1.5">
                          <span className="font-bold text-[#0f172a]">1.</span>
                          <span>Buka aplikasi m-Banking atau E-Wallet pilihan Anda.</span>
                        </p>
                        <p className="flex items-start gap-1.5">
                          <span className="font-bold text-[#0f172a]">2.</span>
                          <span>Pilih menu Scan QR lalu scan kode QR di samping.</span>
                        </p>
                        <p className="flex items-start gap-1.5">
                          <span className="font-bold text-[#0f172a]">3.</span>
                          <span>
                            Pastikan nominal pembayaran sesuai (<strong>Rp {order.total.toLocaleString("id-ID")}</strong>).
                          </span>
                        </p>
                      </div>

                      {/* Demo Simulate Button */}
                      <div className="pt-2">
                        <button
                          onClick={handleVerifyPayment}
                          disabled={isVerifying}
                          className="btn-press w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                        >
                          {isVerifying ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Memverifikasi Pembayaran...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>⚡ Simulasikan Scan & Bayar QRIS Berhasil</span>
                            </>
                          )}
                        </button>
                        <span className="text-[10px] text-slate-500 text-center block mt-1">
                          Klik tombol di atas untuk simulasi real-time verifikasi nota.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIRTUAL ACCOUNT */}
              {activeTab === "bank_transfer" && (
                <div className="space-y-5">
                  {/* Select Bank */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748b] block mb-2">
                      PILIH BANK TUJUAN VIRTUAL ACCOUNT:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "bca", name: "BCA Virtual Account", color: "border-blue-600 text-blue-700" },
                        { id: "mandiri", name: "Mandiri Bill", color: "border-yellow-600 text-yellow-800" },
                        { id: "bni", name: "BNI Virtual Account", color: "border-orange-600 text-orange-700" },
                        { id: "bri", name: "BRIVA", color: "border-blue-800 text-blue-900" },
                      ].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBank(b.id as "bca" | "mandiri" | "bni" | "bri");
                            initCharge("bank_transfer", b.id);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                            selectedBank === b.id
                              ? "bg-slate-900 text-white font-bold border-slate-900 shadow-sm"
                              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                          }`}
                        >
                          <span className="block text-[11px] font-mono uppercase">{b.id}</span>
                          <span className="text-[10px] opacity-80 block truncate">{b.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* VA Number Card */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-[#64748b]">
                      NOMOR VIRTUAL ACCOUNT ({selectedBank.toUpperCase()})
                    </span>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-lg sm:text-xl font-mono font-bold text-[#0f172a] tracking-wider">
                        {chargeData?.va_number || "Memuat No. VA..."}
                      </strong>
                      <button
                        onClick={() => handleCopy(chargeData?.va_number || "")}
                        className="btn-press px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-[#0f172a] flex items-center gap-1.5 shrink-0"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin No. VA</span>
                          </>
                        )}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Nama Rekening: <strong>LaundryHub - {order.customer?.name || "Pelanggan"}</strong>
                    </span>
                  </div>

                  {/* Transfer Instructions Accordion */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-[#0f172a] block">Petunjuk Pembayaran Transfer:</span>
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 space-y-1.5">
                      <p>1. Buka aplikasi m-Banking atau ATM bank pilihan Anda.</p>
                      <p>2. Pilih menu Transfer Virtual Account / Pembayaran.</p>
                      <p>
                        3. Tempel Nomor VA di atas lalu pastikan jumlah tagihan tepat <strong>Rp {order.total.toLocaleString("id-ID")}</strong>.
                      </p>
                      <p>4. Masukkan PIN dan simpan struk transfer Anda.</p>
                    </div>
                  </div>

                  {/* Demo Simulate Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleVerifyPayment}
                      disabled={isVerifying}
                      className="btn-press w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-700 to-blue-800 hover:from-sky-800 hover:to-blue-900 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi Pembayaran...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>⚡ Simulasikan Transfer VA {selectedBank.toUpperCase()} Berhasil</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: E-WALLET */}
              {activeTab === "ewallet" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748b] block mb-2">PILIH E-WALLET:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "gopay", name: "GoPay", color: "bg-emerald-50 text-emerald-800" },
                        { id: "ovo", name: "OVO", color: "bg-purple-50 text-purple-800" },
                        { id: "shopeepay", name: "ShopeePay", color: "bg-orange-50 text-orange-800" },
                        { id: "dana", name: "DANA", color: "bg-blue-50 text-blue-800" },
                      ].map((w) => (
                        <button
                          key={w.id}
                          onClick={() => {
                            setSelectedEwallet(w.id as "gopay" | "ovo" | "shopeepay" | "dana");
                            initCharge("ewallet", undefined, w.id);
                          }}
                          className={`p-3 rounded-xl border text-center text-xs transition-all ${
                            selectedEwallet === w.id
                              ? "bg-slate-900 text-white font-bold border-slate-900 shadow-sm"
                              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                          }`}
                        >
                          <span className="block font-semibold">{w.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">NOMOR WHATSAPP TERDAFTAR</span>
                    <strong className="text-sm font-mono text-slate-900 block">
                      {order.customer?.phone || "081234567890"}
                    </strong>
                    <span className="text-[11px] text-slate-600 block">
                      Notifikasi konfirmasi pembayaran akan dikirimkan otomatis ke aplikasi {selectedEwallet.toUpperCase()}.
                    </span>
                  </div>

                  {/* Demo Simulate Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleVerifyPayment}
                      disabled={isVerifying}
                      className="btn-press w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Menghubungi E-Wallet...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          <span>⚡ Buka & Konfirmasi Bayar via {selectedEwallet.toUpperCase()}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Enkripsi Payment Gateway</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
