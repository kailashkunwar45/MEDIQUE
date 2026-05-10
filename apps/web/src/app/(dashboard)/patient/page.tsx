"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutDashboard, CalendarDays, Bell, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { io, Socket } from "socket.io-client";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "hospital_admin" | "super_admin";
  hospitalId?: string;
  accessToken: string;
  refreshToken?: string;
};

type Hospital = {
  _id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone?: string;
};

type Doctor = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization?: string;
  hospitalId?: string;
  appointmentFee?: number;
};

type Appointment = {
  _id: string;
  doctorId: Doctor;
  hospitalId: Hospital;
  date: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "declined";
  paymentMethod: "online" | "pay_later";
  paymentStatus: "paid" | "unpaid";
  tokenNumber?: number;
  cancelledAt?: string;
  forfeited?: boolean;
  doctorNotes?: string;
};

type ChatMessage = {
  _id: string;
  appointmentId: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
};

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function PaymentBadge({ status, method, amount }: { status: "paid" | "unpaid"; method: string; amount?: number }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${status === "paid"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
    }`}>
      {status === "paid" ? "✓ PAID" : "⏳ UNPAID"} {amount ? `($${amount})` : ""} · {method === "online" ? "Online" : "Cash on Checkup"}
    </span>
  );
}

export default function PatientDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorHospitals, setDoctorHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [totalUnread, setTotalUnread] = useState(0);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");

  const standardSpecializations = [
    "Cardiology", "Dermatology", "ENT", "Gastroenterology", 
    "General Practice", "Gynecology", "Neurology", "Oncology", 
    "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry", 
    "Radiology", "Urology"
  ];

  const derivedSpecializations = doctors.map(d => d.specialization).filter(Boolean) as string[];
  const availableSpecializations = Array.from(new Set([...standardSpecializations, ...derivedSpecializations])).sort();

  const filteredDoctors = selectedSpecialization 
    ? doctors.filter(d => (d.specialization || "").toLowerCase() === selectedSpecialization.toLowerCase()) 
    : doctors;

  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const spec = e.target.value;
    setSelectedSpecialization(spec);
    const newFiltered = spec ? doctors.filter(d => (d.specialization || "").toLowerCase() === spec.toLowerCase()) : doctors;
    if (newFiltered.length > 0) {
      setSelectedDoctorId(newFiltered[0]._id);
    } else {
      setSelectedDoctorId("");
    }
  };
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_later">("pay_later");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeChatAppointmentId, setActiveChatAppointmentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [currentView, setCurrentView] = useState<"active" | "history">("active");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const activeChatRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChatAppointmentId;
    if (activeChatAppointmentId) {
      setUnreadCounts(prev => ({ ...prev, [activeChatAppointmentId]: 0 }));
    }
  }, [activeChatAppointmentId]);

  const loadUnreadCount = async () => {
    try {
      const data = await authFetch("/api/chat/conversations");
      const total = data.reduce((acc: number, conv: any) => acc + (conv.unreadCount || 0), 0);
      setTotalUnread(total);
    } catch (e) { console.error("Failed to load unread count", e); }
  };

  useEffect(() => { 
    const s = getSession();
    if (s && s.role !== "patient") {
      window.location.href = `/${s.role === 'hospital_admin' ? 'hospital-admin' : s.role === 'super_admin' ? 'super-admin' : s.role}`;
      return;
    }
    setSession(s); 

    if (s?.accessToken) {
      loadMyAppointments();
      loadUnreadCount();
      const socket = io();
      globalSocketRef.current = socket;
      socket.emit("registerUser", { token: s.accessToken });
      
      socket.on("messageNotification", (msg: ChatMessage) => {
        loadUnreadCount();
        if (activeChatRef.current !== msg.appointmentId) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.appointmentId]: (prev[msg.appointmentId] || 0) + 1
          }));
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, []);
  const loadHospitals = async () => {
    setError("");
    setInfo("");
    try {
      const data = await authFetch("/api/hospitals");
      setHospitals(data);
      setDoctorHospitals(data);
      if (Array.isArray(data) && data.length && !selectedHospitalId) {
        setSelectedHospitalId(data[0]._id);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load hospitals");
    }
  };

  const loadDoctors = async () => {
    setError("");
    setInfo("");
    try {
      const data = await authFetch(`/api/users/doctors`);
      setDoctors(data);
      setSelectedSpecialization("");
      if (Array.isArray(data) && data.length) {
        setSelectedDoctorId(data[0]._id);
      } else {
        setSelectedDoctorId("");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load doctors");
    }
  };

  const logout = () => {
    localStorage.removeItem("mediqueue_session");
    window.location.href = "/login";
  };

  const loadMyAppointments = async () => {
    setError("");
    setInfo("");
    try {
      const data = await authFetch("/api/appointments/my");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load appointments");
    }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    void loadHospitals();
    void loadDoctors();
    void loadMyAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  useEffect(() => {
    if (selectedDoctorId && doctors.length > 0) {
      const doc = doctors.find(d => d._id === selectedDoctorId);
      if (doc?.hospitalId) {
        const hId = typeof doc.hospitalId === 'object' ? (doc.hospitalId as any)._id : doc.hospitalId;
        setSelectedHospitalId(hId);
      }
    }
  }, [selectedDoctorId, doctors]);

  const bookAppointment = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!selectedHospitalId) throw new Error("Select a hospital");
      if (!selectedDoctorId) throw new Error("Select a doctor");

      await authFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          hospitalId: selectedHospitalId,
          doctorId: selectedDoctorId,
          date: new Date(date).toISOString(),
          paymentMethod,
        }),
      });

      setInfo(
        paymentMethod === "online"
          ? "Booked and marked as PAID (online now)."
          : "Booked and marked as UNPAID (pay after checkup)."
      );
      await loadMyAppointments();
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (appointmentId: string) => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await authFetch("/api/appointments/cancel", {
        method: "POST",
        body: JSON.stringify({ appointmentId }),
      });
      setInfo("Booking cancelled. If it was paid, it is forfeited (no refund).");
      await loadMyAppointments();
    } catch (e: any) {
      setError(e?.message || "Cancel failed");
    } finally {
      setLoading(false);
    }
  };

  const openChat = async (appointmentId: string) => {
    if (activeChatAppointmentId === appointmentId) {
      setActiveChatAppointmentId(null);
      (window as any).__mediqueue_chat_socket?.disconnect?.();
      return;
    }
    setError("");
    setInfo("");
    setActiveChatAppointmentId(appointmentId);
    setMessages([]);

    try {
      const history = await authFetch(`/api/chat/${appointmentId}/messages`);
      setMessages(history?.messages || []);
    } catch (e: any) {
      setError(e?.message || "Cannot open chat");
      return;
    }

    const socket = io();
    socket.emit("joinChat", { appointmentId, token: session?.accessToken });
    socket.on("message", (msg: ChatMessage) => {
      if (msg.appointmentId !== appointmentId) return;
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("chatError", (p: any) => {
      setError(p?.message || "Chat error");
    });

    (window as any).__mediqueue_chat_socket?.disconnect?.();
    (window as any).__mediqueue_chat_socket = socket;
  };

  const sendChat = async () => {
    setError("");
    const appointmentId = activeChatAppointmentId;
    const text = chatText.trim();
    if (!appointmentId) return;
    if (!text) return;

    const socket = (window as any).__mediqueue_chat_socket;
    if (!socket) {
      setError("Chat socket not connected");
      return;
    }
    socket.emit("sendMessage", { appointmentId, token: session?.accessToken, text });
    setChatText("");
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendChat();
    }
  };

  const requestChat = async (doctorId: string) => {
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/chat/request", {
        method: "POST",
        body: JSON.stringify({ doctorId }),
      });
      setInfo("Chat request sent to the doctor. You will be notified when they accept.");
    } catch (e: any) {
      setError(e?.message || "Failed to send chat request");
    } finally {
      setLoading(false);
    }
  };

  const toggleHistorySelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHistoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const deleteHistory = async (idsToDelete?: string[]) => {
    const ids = idsToDelete || selectedHistoryIds;
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} appointment(s) from your history?`)) return;
    
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/appointments/history", {
        method: "DELETE",
        body: JSON.stringify({ appointmentIds: ids })
      });
      setInfo(`Successfully deleted ${ids.length} historical record(s).`);
      setSelectedHistoryIds([]);
      setExpandedHistoryId(null);
      await loadMyAppointments();
    } catch (e: any) {
      setError(e?.message || "Failed to delete history");
    } finally {
      setLoading(false);
    }
  };

  const activeAppointments = appointments.filter(a => a.status === "pending" || a.status === "confirmed");
  const historyAppointments = appointments.filter(a => a.status === "completed" || a.status === "cancelled" || a.status === "declined");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Top bar - Glass Navigation */}
      <div className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200 px-8 py-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl border border-slate-100 p-2">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tighter text-[#0F172A] uppercase">MediQueue</h1>
                {session && (
                  <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase opacity-70 mt-0.5">
                    Patient Profile: <span className="text-[#1E3A8A] font-black">{session.name}</span>
                  </p>
                )}
             </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/hospitals">
               <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm">Facility Search</Button>
            </Link>
            {currentView === "history" && selectedHistoryIds.length > 0 && (
              <Button 
                variant="destructive" 
                className="rounded-[14px] px-6 py-6 font-bold transition-all shadow-sm shadow-rose-200"
                onClick={(e) => { e.stopPropagation(); deleteHistory(); }}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedHistoryIds.length})
              </Button>
            )}
            <Button 
              variant={currentView === "history" ? "default" : "outline"} 
              className={`rounded-[14px] px-6 py-6 font-bold transition-all shadow-sm ${currentView === "history" ? 'bg-[#1E3A8A] text-white' : 'border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A]'}`}
              onClick={() => setCurrentView(currentView === "active" ? "history" : "active")}
            >
              {currentView === "active" ? "Appointment History" : "Back to Active"}
            </Button>
            <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm" onClick={loadMyAppointments} disabled={loading}>
              {loading ? "Syncing Logic..." : "Sync Feed"}
            </Button>
            <Button variant="ghost" className="rounded-[14px] px-6 py-6 font-bold text-rose-500 hover:bg-rose-50 transition-all" onClick={logout}>
              Log Out
            </Button>

            <Link href="/chat">
               <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm relative group">
                 Secure Chat
                 {totalUnread > 0 && (
                   <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full border-4 border-[#F8FAFC] font-black group-hover:scale-110 transition-transform animate-bounce">
                     {totalUnread}
                   </span>
                 )}
               </Button>
            </Link>
            
            <Link href="/profile">
               <Button className="rounded-[14px] px-8 py-6 font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] shadow-xl transition-all scale-95 hover:scale-100 gold-glow-hover">Medical ID</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {!session?.accessToken && (
          <div className="text-xs font-black uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-100 rounded-[20px] p-6 text-center">
            Authorization required. Redirecting to <Link className="underline text-primary" href="/login">Secure Portal</Link>...
          </div>
        )}
        {error && <div className="text-xs font-black uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-100 rounded-[20px] p-6">{error}</div>}
        {info && <div className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-[20px] p-6">{info}</div>}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Book Appointment */}
          <Card className="rounded-[20px] border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.08)] bg-white overflow-hidden lg:col-span-1">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tighter text-[#0F172A]">Schedule Encounter</CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select medical facility and specialist</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Target Facility</Label>
                <select
                  className="w-full rounded-[16px] bg-slate-50 border border-slate-200 px-4 py-4 text-sm font-bold text-[#0F172A] outline-none focus:border-accent"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  disabled={!session?.accessToken || doctorHospitals.length === 0}
                >
                  {doctorHospitals.length === 0 ? (
                    <option>Awaiting Specialist Selection...</option>
                  ) : (
                    doctorHospitals.map((h: Hospital) => <option key={h._id} value={h._id}>{h.name}</option>)
                  )}
                </select>
                {selectedHospitalId && (
                  <Link href={`/hospitals/detail?id=${selectedHospitalId}`} className="text-[10px] font-black text-[#1E3A8A] hover:underline uppercase tracking-tighter block mt-2 opacity-60">Facility Dossier →</Link>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Specialization Filter</Label>
                <select
                  className="w-full rounded-[16px] bg-slate-50 border border-slate-200 px-4 py-4 text-sm font-bold text-[#0F172A] outline-none focus:border-accent"
                  value={selectedSpecialization}
                  onChange={handleSpecializationChange}
                  disabled={!session?.accessToken || availableSpecializations.length === 0}
                >
                  <option value="">All Categories</option>
                  {availableSpecializations.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Medical Specialist</Label>
                <select
                  className="w-full rounded-[16px] bg-slate-50 border border-slate-200 px-4 py-4 text-sm font-bold text-[#0F172A] outline-none focus:border-accent"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  disabled={!session?.accessToken || filteredDoctors.length === 0}
                >
                  {filteredDoctors.length === 0 ? (
                    <option>No specialists found</option>
                  ) : (
                     filteredDoctors.map((d) => (
                       <option key={d._id} value={d._id}>
                         {d.name}{d.specialization ? ` | ${d.specialization}` : ""} {d.appointmentFee ? ` ($${d.appointmentFee})` : ""}
                       </option>
                     ))
                  )}
                </select>
                {selectedDoctorId && (
                  <Link href={`/doctors?id=${selectedDoctorId}`} className="text-[10px] font-black text-[#1E3A8A] hover:underline uppercase tracking-tighter block mt-2 opacity-60">Doctor Dossier →</Link>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Encounter Date</Label>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-[16px] bg-slate-50 border border-slate-200 px-4 py-4 text-sm font-bold text-[#0F172A] outline-none focus:border-accent"
                  disabled={!session?.accessToken}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Settlement Protocol</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest rounded-[16px] border transition-all ${paymentMethod === "online"
                      ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-lg gold-glow"
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                    disabled={!session?.accessToken}
                  >
                    💳 Instant Settlement<br />
                    <span className="opacity-60 mt-1 block">Pre-Paid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pay_later")}
                    className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest rounded-[16px] border transition-all ${paymentMethod === "pay_later"
                      ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-lg gold-glow"
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                    disabled={!session?.accessToken}
                  >
                    💵 Post-Checkup<br />
                    <span className="opacity-60 mt-1 block">Due on Site</span>
                  </button>
                </div>
              </div>

              <Button onClick={bookAppointment} className="w-full rounded-[16px] py-8 font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] shadow-xl transition-all scale-95 hover:scale-100 uppercase tracking-widest gold-glow-hover" disabled={!session?.accessToken || loading}>
                {loading ? "Processing Sequence..." : "Confirm Booking"}
              </Button>

              <div className="text-[10px] font-bold text-slate-500 bg-white/5 rounded-2xl p-6 border border-white/5 leading-relaxed">
                ⚠️ <strong className="text-white">Cancellation Protocol:</strong> Encounter can be cancelled at any time. Pre-paid settlements are non-refundable upon cancellation.
              </div>
            </CardContent>
          </Card>

          {/* My Bookings */}
          <Card className="rounded-[20px] border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.08)] bg-white overflow-hidden lg:col-span-2">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-8 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tighter text-[#0F172A]">Active Dossiers</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time communication with authorized specialists</CardDescription>
              </div>
              <Button variant="outline" className="rounded-[14px] border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] font-bold" onClick={loadMyAppointments} disabled={!session?.accessToken || loading}>
                Sync Feed
              </Button>
            </CardHeader>
            <CardContent className="p-8">
              {currentView === "active" ? (
                activeAppointments.length === 0 ? (
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-16 text-center opacity-40 italic">System clear. No pending encounters.</div>
                ) : (
                  <div className="space-y-6">
                    {activeAppointments.map((a) => (
                      <div key={a._id} className="rounded-[20px] border border-slate-100 p-6 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all group border-l-4 border-l-[#1E3A8A]">
                        <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="flex gap-6">
                           <div className="w-16 h-16 rounded-[14px] bg-[#1E3A8A]/10 flex items-center justify-center text-2xl font-black text-[#1E3A8A] shadow-sm group-hover:scale-110 transition-transform">
                              {a.doctorId?.name[0]}
                           </div>
                           <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <Link href={`/doctors?id=${a.doctorId?._id}`} className="font-black text-[#0F172A] text-lg tracking-tight uppercase hover:underline">
                                  Dr. {a.doctorId?.name || "Specialist"}
                                </Link>
                                 {a.doctorId?.specialization && (
                                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{a.doctorId.specialization} {a.doctorId.appointmentFee ? `· $${a.doctorId.appointmentFee}` : ""}</span>
                                 )}
                              </div>
                              <div className="text-xs font-bold text-slate-500">
                                <Link href={`/hospitals/detail?id=${a.hospitalId?._id}`} className="hover:text-[#1E3A8A] transition-colors uppercase tracking-widest">
                                  🏥 {a.hospitalId?.name}
                                </Link>
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <CalendarDays className="w-3 h-3" />
                                {new Date(a.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                                {a.tokenNumber && <span className="bg-[#1E3A8A]/10 text-[#1E3A8A] px-2 py-0.5 rounded-md ml-2">Token #{a.tokenNumber}</span>}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-3">
                                <StatusBadge status={a.status} />
                                <PaymentBadge status={a.paymentStatus} method={a.paymentMethod} amount={a.doctorId?.appointmentFee} />
                              </div>
                           </div>
                        </div>

                        <div className="flex gap-3 items-center relative">
                          {unreadCounts[a._id] > 0 && activeChatAppointmentId !== a._id && (
                            <div className="absolute -top-3 -right-2 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full shadow-lg animate-bounce z-10 border-2 border-white">
                              <Bell className="w-3 h-3 mr-0.5" />
                              {unreadCounts[a._id]}
                            </div>
                          )}
                          {a.status !== "cancelled" && a.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-[14px] text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50"
                              onClick={() => cancelBooking(a._id)}
                              disabled={loading}
                            >
                              Cancel
                            </Button>
                          )}
                          {a.status === "confirmed" && (
                            <Button
                              className={`rounded-[16px] px-8 py-6 font-black uppercase text-[10px] tracking-widest transition-all ${activeChatAppointmentId === a._id ? 'bg-[#1E3A8A] text-white shadow-lg' : 'bg-white text-[#1E3A8A] border border-[#1E3A8A] hover:bg-slate-50'}`}
                              onClick={() => openChat(a._id)}
                            >
                              {activeChatAppointmentId === a._id ? "Close Comm" : "Secure Chat"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline Chat Panel */}
                      {activeChatAppointmentId === a._id && (
                        <div className="mt-8 rounded-[20px] border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
                          <div className="text-[10px] font-black uppercase text-slate-400 mb-6 flex items-center justify-between tracking-widest opacity-60">
                            <span>Link established with specialist</span>
                            <span>Auto-termination in 24H</span>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto space-y-4 pr-3 flex flex-col custom-scrollbar">
                            {messages.length === 0 ? (
                              <div className="text-[10px] font-black uppercase text-slate-300 text-center py-12 italic tracking-widest">No communication history.</div>
                            ) : (
                              messages.map((m) => {
                                const isMe = String(m.senderId) === String(session?._id);
                                return (
                                  <div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-[16px] px-4 py-3 text-sm font-medium ${isMe
                                      ? "bg-[#1E3A8A] text-white rounded-tr-none shadow-md"
                                      : "bg-slate-100 text-[#0F172A] rounded-tl-none border border-slate-200"
                                    }`}>
                                      {!isMe && <div className="text-[10px] font-black opacity-60 uppercase mb-1 tracking-widest">{m.senderRole}</div>}
                                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</div>
                                      <div className={`text-[10px] mt-2 font-black opacity-40 ${isMe ? "text-white/70 text-right" : "text-slate-500"}`}>
                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div ref={chatEndRef} />
                          </div>
                          <div className="mt-8 flex gap-3">
                            <Input
                              value={chatText}
                              onChange={(e) => setChatText(e.target.value)}
                              onKeyDown={handleChatKeyDown}
                              placeholder="Transmit message..."
                              className="rounded-[16px] bg-slate-50 border-slate-200 py-7 px-6 text-sm font-bold placeholder:text-slate-400 outline-none focus:border-accent"
                            />
                            <Button onClick={sendChat} className="rounded-[16px] px-10 py-7 font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] uppercase tracking-widest text-[10px] gold-glow-hover">Send</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              // HISTORY VIEW
              historyAppointments.length === 0 ? (
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-16 text-center opacity-40 italic">Archive empty. No historical encounters.</div>
              ) : (
                <div className="space-y-4">
                  {historyAppointments.map((a) => (
                    <Card key={a._id} className={`rounded-[24px] border ${selectedHistoryIds.includes(a._id) ? 'border-rose-400 bg-rose-50/20' : 'border-slate-100 bg-slate-50/30'} shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden`} onClick={() => setExpandedHistoryId(expandedHistoryId === a._id ? null : a._id)}>
                      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                         <div className="flex items-center gap-5">
                            <div 
                              className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${selectedHistoryIds.includes(a._id) ? 'bg-rose-500 border-rose-500' : 'bg-white border-slate-300'}`}
                              onClick={(e) => toggleHistorySelection(a._id, e)}
                            >
                              {selectedHistoryIds.includes(a._id) && <div className="w-3 h-3 bg-white rounded-sm" />}
                            </div>
                            <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center font-black text-xl shadow-inner border ${a.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                               {a.doctorId?.name[0] || "D"}
                            </div>
                            <div>
                               <span className="font-black text-[#0F172A] text-lg block tracking-tight uppercase transition-colors">Dr. {a.doctorId?.name}</span>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(a.date).toDateString()} · {a.hospitalId?.name}</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <StatusBadge status={a.status} />
                         </div>
                      </div>
                      {expandedHistoryId === a._id && (
                        <div className="p-8 pt-4 border-t border-slate-100 bg-white animate-in slide-in-from-top-4 duration-500">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <div className="space-y-2"><span className="opacity-60 block">Doctor Phone</span><span className="text-[#0F172A] block">{a.doctorId?.phone || "N/A"}</span></div>
                              <div className="space-y-2"><span className="opacity-60 block">Settlement Status</span><span className="text-emerald-600">{a.paymentStatus} ({a.paymentMethod})</span></div>
                           </div>
                           
                           {a.status === 'completed' && (
                             <>
                               <div className="pt-6 border-t border-slate-100 mt-2">
                                  <Label className="text-[10px] font-black uppercase text-[#1E3A8A] tracking-[0.2em] mb-4 block">Doctor Notes & Diagnosis</Label>
                                  <div className="p-6 rounded-[20px] bg-slate-50 border border-slate-100 text-sm text-[#0F172A] italic whitespace-pre-wrap leading-relaxed">
                                     "{a.doctorNotes || "No clinical data was recorded."}"
                                  </div>
                               </div>
                               <div className="pt-6 mt-6 flex justify-end gap-3">
                                  <Button 
                                    variant="outline"
                                    className="rounded-[14px] font-black uppercase text-[10px] tracking-widest text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                    onClick={(e) => { e.stopPropagation(); deleteHistory([a._id]); }}
                                    disabled={loading}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </Button>
                                  <Button 
                                    className="rounded-[14px] font-black uppercase text-[10px] tracking-widest bg-[#1E3A8A] text-white shadow-md hover:bg-[#2563EB]"
                                    onClick={(e) => { e.stopPropagation(); requestChat(a.doctorId._id); }}
                                    disabled={loading}
                                  >
                                    Request to Chat
                                  </Button>
                               </div>
                             </>
                           )}
                           {a.status !== 'completed' && (
                             <div className="pt-6 mt-6 flex justify-end">
                                <Button 
                                  variant="outline"
                                  className="rounded-[14px] font-black uppercase text-[10px] tracking-widest text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                  onClick={(e) => { e.stopPropagation(); deleteHistory([a._id]); }}
                                  disabled={loading}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete Record
                                </Button>
                             </div>
                           )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )
            )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
