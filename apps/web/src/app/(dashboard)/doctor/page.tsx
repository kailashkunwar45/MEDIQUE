"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Building2, LayoutDashboard, Clock, CheckCircle2, History, MessageSquare, Plus } from "lucide-react";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "hospital_admin" | "super_admin";
  hospitalId?: string;
  hospitalIds?: string[];
  accessToken: string;
};

type Patient = { _id: string; name: string; email: string; phone?: string };
type Hospital = { _id: string; name: string; address: string };

type Appointment = {
  _id: string;
  patientId: Patient;
  hospitalId: Hospital;
  date: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "declined";
  paymentMethod: "online" | "pay_later";
  paymentStatus: "paid" | "unpaid";
  tokenNumber?: number;
  hospitalLocked: boolean;
  doctorNotes?: string;
  declineReason?: string;
};

type ChatMessage = {
  _id: string;
  appointmentId: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
};

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    declined: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${map[status]}`}>{status}</span>;
}

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function DoctorDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSession(getSession()); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const authFetch = async (path: string, init?: RequestInit) => {
    const s = getSession();
    if (!s?.accessToken) throw new Error("Not logged in");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.accessToken}`,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
    return json;
  };

  const loadAppointments = async () => {
    if (session?.isApprovedBySuperAdmin === false) return;
    setError(""); setLoading(true);
    try {
      const data = await authFetch("/api/appointments/doctor");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message || "Failed to load appointments"); }
    finally { setLoading(false); }
  };

  const loadDoctorHospitals = async () => {
    if (session?.isApprovedBySuperAdmin === false) return;
    try {
      const s = getSession();
      if (!s) return;
      // Get hospitals doctor belongs to
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${s.accessToken}` }
      });
      const data = await res.json();
      if (data.hospitalIds) {
        const hospitalData = await Promise.all(
          data.hospitalIds.map((id: string) => 
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hospitals/${id}`, {
               headers: { Authorization: `Bearer ${s.accessToken}` }
            }).then(r => r.json().then(d => d.hospital))
          )
        );
        setHospitals(hospitalData.filter(h => !!h));
      }
    } catch (e) { console.error("Failed to load hospitals", e); }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    void loadAppointments();
    void loadDoctorHospitals();
  }, [session?.accessToken]);

  const acceptAppointment = async (appointmentId: string) => {
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/appointments/accept", { method: "POST", body: JSON.stringify({ appointmentId }) });
      setInfo("Appointment accepted! You can now chat with the patient.");
      await loadAppointments();
    } catch (e: any) { setError(e?.message || "Failed to accept"); }
    finally { setLoading(false); }
  };

  const declineAppointment = async (appointmentId: string) => {
    if (!declineReason) { setError("Please provide a reason for declining."); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/appointments/decline", { 
        method: "POST", 
        body: JSON.stringify({ appointmentId, reason: declineReason }) 
      });
      setInfo("Appointment declined.");
      setShowDeclineInput(null);
      setDeclineReason("");
      await loadAppointments();
    } catch (e: any) { setError(e?.message || "Failed to decline"); }
    finally { setLoading(false); }
  };

  const changeHospital = async (appointmentId: string, hospitalId: string) => {
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/appointments/change-hospital", { 
        method: "PUT", 
        body: JSON.stringify({ appointmentId, hospitalId }) 
      });
      setInfo("Hospital updated. Patient has been notified.");
      await loadAppointments();
    } catch (e: any) { setError(e?.message || "Failed to change hospital"); }
    finally { setLoading(false); }
  };

  const completeAppointment = async (appointmentId: string) => {
    setError(""); setInfo(""); setLoading(true);
    try {
      await authFetch("/api/appointments/complete", { 
        method: "POST", 
        body: JSON.stringify({ appointmentId, doctorNotes: noteText }) 
      });
      setInfo("Appointment marked as completed.");
      setNoteText("");
      await loadAppointments();
    } catch (e: any) { setError(e?.message || "Failed to complete"); }
    finally { setLoading(false); }
  };

  const openChat = async (appointmentId: string) => {
    setError(""); setActiveChatId(appointmentId); setMessages([]);
    socketRef.current?.disconnect();
    try {
      const history = await authFetch(`/api/chat/${appointmentId}/messages`);
      setMessages(history?.messages || []);
    } catch (e: any) { setError(e?.message || "Cannot open chat"); return; }

    const s = getSession();
    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005");
    socketRef.current = socket;
    socket.emit("joinChat", { appointmentId, token: s?.accessToken });
    socket.on("message", (msg: ChatMessage) => {
      if (msg.appointmentId !== appointmentId) return;
      setMessages((prev) => [...prev, msg]);
    });
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!activeChatId || !text || !socketRef.current) return;
    const s = getSession();
    socketRef.current.emit("sendMessage", { appointmentId: activeChatId, token: s?.accessToken, text });
    setChatText("");
  };

  const pending = appointments.filter((a) => a.status === "pending");
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const past = appointments.filter((a) => ["completed", "cancelled", "declined"].includes(a.status));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans dark">
      <div className="w-full bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5 px-8 py-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[20px] bg-[#1E3A8A]/20 flex items-center justify-center shadow-2xl border border-white/10 p-2 vip-border">
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase text-white">MediQueue</h1>
              <p className="text-slate-400 mt-1 text-sm font-bold opacity-70">
                Authorized Specialist: <span className="text-[#D4AF37] font-black tracking-widest uppercase">Dr. {session?.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-[14px] px-6 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold" onClick={loadAppointments} disabled={loading}>
              {loading ? "Syncing..." : "Refresh Feed"}
            </Button>
            <Link href="/profile">
              <Button className="rounded-2xl px-6 font-bold shadow-lg shadow-primary/20">My Profile</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {error && <div className="mb-6 p-4 text-sm font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-[16px]">{error}</div>}
        {info && <div className="mb-6 p-4 text-sm font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-[16px]">{info}</div>}

        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="grid w-full max-w-[500px] grid-cols-3 rounded-[16px] bg-[#0F172A] p-1 border border-white/5 shadow-2xl">
            <TabsTrigger value="requests" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
              Requests {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="current" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
              Current {confirmed.length > 0 && `(${confirmed.length})`}
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
              History
            </TabsTrigger>
          </TabsList>

          {/* REQUESTS TAB */}
          <TabsContent value="requests" className="space-y-4">
            {pending.length === 0 ? (
              <div className="text-center py-20 bg-white/5 rounded-[20px] border border-dashed border-white/10">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No pending encounters found.</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {pending.map((a) => (
                  <Card key={a._id} className={`rounded-[20px] border-white/5 bg-[#0F172A]/50 backdrop-blur-xl transition-all duration-300 ${expandedAppointmentId === a._id ? 'shadow-2xl gold-glow border-white/20' : 'hover:bg-[#0F172A]'}`}>
                    <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[16px] bg-[#D4AF37]/10 flex items-center justify-center text-2xl font-black text-[#D4AF37] border border-[#D4AF37]/20">
                          {a.patientId.name[0]}
                        </div>
                        <div>
                          <CardTitle className="text-xl font-black tracking-tight text-white uppercase">{a.patientId.name}</CardTitle>
                          <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Requested: {new Date(a.date).toLocaleDateString()}</CardDescription>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {expandedAppointmentId === a._id && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="p-3 rounded-[16px] bg-white/5 border border-white/5">
                                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Email Dossier</span>
                                <span className="font-bold truncate block text-white">{a.patientId.email}</span>
                              </div>
                              <div className="p-3 rounded-[16px] bg-white/5 border border-white/5">
                                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Secure Line</span>
                                <span className="font-bold text-white">{a.patientId.phone || "N/A"}</span>
                              </div>
                              <div className="p-3 rounded-[16px] bg-white/5 border border-white/5 col-span-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Location / Facility</span>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black text-[#D4AF37] uppercase">{a.hospitalId.name}</span>
                                  {!a.hospitalLocked && hospitals.length > 1 && (
                                    <select 
                                      className="text-[10px] bg-black border-white/10 rounded-lg px-2 py-1 font-bold text-white uppercase outline-none"
                                      value={a.hospitalId._id}
                                      onChange={(e) => changeHospital(a._id, e.target.value)}
                                    >
                                      {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                    </select>
                                  )}
                                </div>
                              </div>
                           </div>
                           {showDeclineInput === a._id && (
                             <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reason for declining</Label>
                               <Input 
                                 placeholder="Enter formal reason..." 
                                 value={declineReason} 
                                 onChange={(e) => setDeclineReason(e.target.value)}
                                 className="rounded-[16px] bg-black/30 border-white/10 text-white"
                               />
                             </div>
                           )}
                        </div>
                      )}
                      
                      <div className="flex gap-3 pt-2">
                        {expandedAppointmentId !== a._id ? (
                          <Button variant="outline" className="flex-1 rounded-[16px] font-black uppercase text-[10px] tracking-widest border-white/10 hover:bg-white/5 py-6" onClick={() => setExpandedAppointmentId(a._id)}>
                            Review Dossier
                          </Button>
                        ) : (
                          <>
                            {showDeclineInput === a._id ? (
                              <>
                                <Button variant="ghost" className="rounded-[16px] font-bold text-slate-500" onClick={() => setShowDeclineInput(null)}>Cancel</Button>
                                <Button className="flex-1 rounded-[16px] bg-rose-600 hover:bg-rose-700 font-black uppercase text-[10px] tracking-widest py-6" onClick={() => declineAppointment(a._id)}>Confirm Decline</Button>
                              </>
                            ) : (
                              <>
                                <Button variant="outline" className="rounded-[16px] font-black uppercase text-[10px] tracking-widest border-white/10 py-6" onClick={() => setShowDeclineInput(a._id)}>Decline</Button>
                                <Button className="flex-1 rounded-[16px] bg-[#1E3A8A] hover:bg-[#2563EB] font-black uppercase text-[10px] tracking-widest py-6 shadow-xl gold-glow-hover" onClick={() => acceptAppointment(a._id)}>Authorize Encounter</Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CURRENT TAB */}
          <TabsContent value="current" className="space-y-4">
            {confirmed.length === 0 ? (
              <div className="text-center py-20 bg-white/5 rounded-[20px] border border-dashed border-white/10">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No active encounters scheduled.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {confirmed.map((a) => (
                  <Card key={a._id} className="rounded-[20px] border-white/10 shadow-2xl overflow-hidden bg-[#0F172A]/40 backdrop-blur-xl">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-6 md:w-1/3 bg-white/5 border-r border-white/5 flex flex-col justify-between">
                        <div>
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-[14px] bg-emerald-500/20 flex items-center justify-center text-xl font-bold text-emerald-400">
                                {a.patientId.name[0]}
                              </div>
                              <div>
                                <CardTitle className="text-lg font-black text-white uppercase tracking-tight">{a.patientId.name}</CardTitle>
                                <StatusBadge status={a.status} />
                              </div>
                           </div>
                           <div className="space-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <p className="flex justify-between"><span>Token ID:</span> <span className="text-white">#{a.tokenNumber || "N/A"}</span></p>
                              <p className="flex justify-between"><span>Facility:</span> <span className="text-[#D4AF37] text-right">{a.hospitalId.name}</span></p>
                              <p className="flex justify-between"><span>Window:</span> <span className="text-white">{new Date(a.date).toLocaleDateString()}</span></p>
                              <p className="flex justify-between"><span>Status:</span> <span className={a.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>{a.paymentStatus.toUpperCase()}</span></p>
                           </div>
                        </div>
                        <div className="mt-6 flex flex-col gap-2">
                           <Button 
                             className={`w-full rounded-[14px] font-black uppercase text-[10px] tracking-widest py-6 transition-all ${activeChatId === a._id ? 'bg-[#1E3A8A] text-white shadow-lg' : 'bg-white/5 text-white hover:bg-white/10'}`}
                             onClick={() => openChat(a._id)}
                           >
                             {activeChatId === a._id ? "Active Comm" : "💬 Link Established"}
                           </Button>
                           <Button 
                             variant="outline" 
                             className="w-full rounded-[14px] font-black uppercase text-[10px] tracking-widest py-6 border-white/10 text-slate-400 hover:text-white"
                             onClick={() => setExpandedAppointmentId(expandedAppointmentId === a._id ? null : a._id)}
                           >
                             {expandedAppointmentId === a._id ? "Hide Memory" : "Health Memory"}
                           </Button>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col">
                        {activeChatId === a._id ? (
                          <div className="flex flex-col h-[400px]">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                               {messages.length === 0 ? (
                                 <div className="text-center py-10 text-muted-foreground text-sm italic">No messages yet.</div>
                               ) : (
                                 messages.map((m) => {
                                   const isMe = m.senderId === session?._id;
                                   return (
                                     <div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                       <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-none shadow-md shadow-primary/10" : "bg-muted text-foreground rounded-tl-none"}`}>
                                          {!isMe && <div className="text-[10px] font-bold opacity-60 uppercase mb-1">{m.senderRole}</div>}
                                          <div>{m.text}</div>
                                          <div className="text-[10px] mt-1 opacity-50 text-right">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                       </div>
                                     </div>
                                   );
                                 })
                               )}
                               <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 bg-muted/10 border-t border-muted flex gap-2">
                               <Input 
                                 placeholder="Type a message..." 
                                 value={chatText} 
                                 onChange={(e) => setChatText(e.target.value)}
                                 onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                 className="rounded-2xl"
                               />
                               <Button onClick={sendChat} className="rounded-2xl px-6 font-bold">Send</Button>
                            </div>
                          </div>
                        ) : expandedAppointmentId === a._id ? (
                           <div className="p-8 flex flex-col h-full justify-between animate-in fade-in zoom-in-95">
                              <div className="space-y-4">
                                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Health Memory & Observations</h3>
                                 <p className="text-sm text-slate-500 font-medium">Record clinical observations for this patient's permanent dossier.</p>
                                 <textarea 
                                   className="w-full h-48 rounded-[20px] bg-black/40 border border-white/10 focus:border-[#D4AF37]/50 p-6 text-sm text-white resize-none transition-all outline-none"
                                   placeholder="Symptoms, diagnosis, prescriptions, and follow-up protocol..."
                                   value={noteText}
                                   onChange={(e) => setNoteText(e.target.value)}
                                 />
                              </div>
                              <Button 
                                className="w-full rounded-[16px] py-8 text-[10px] font-black uppercase tracking-widest bg-[#1E3A8A] hover:bg-[#2563EB] shadow-2xl gold-glow-hover mt-6"
                                onClick={() => completeAppointment(a._id)}
                              >
                                Finalize Encounter & Commit Dossier
                              </Button>
                           </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center p-10 text-center">
                            <div className="max-w-[350px] space-y-4">
                              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/5">
                                <Stethoscope className="text-slate-500 w-8 h-8 opacity-40" />
                              </div>
                              <p className="text-slate-500 font-medium text-sm italic leading-relaxed">"Ensure high-precision care. Use the secure channel to coordinate or the health memory to document the clinical encounter."</p>
                              <div className="pt-4 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                 <span className="bg-white/5 px-3 py-1 rounded-full">Subject: {a.patientId.name}</span>
                                 <span className="bg-white/5 px-3 py-1 rounded-full">Ref: {a._id.slice(-6)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PAST TAB */}
          <TabsContent value="past" className="space-y-4">
             {past.length === 0 ? (
              <div className="text-center py-20 bg-white/5 rounded-[20px] border border-dashed border-white/10">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No historical records available.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {past.map((a) => (
                  <Card key={a._id} className="rounded-[16px] border-white/5 bg-[#0F172A]/30 hover:bg-[#0F172A]/50 transition-all cursor-pointer" onClick={() => setExpandedAppointmentId(expandedAppointmentId === a._id ? null : a._id)}>
                    <CardHeader className="p-5 flex-row items-center justify-between space-y-0">
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center font-black text-lg ${a.status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-rose-500/10 text-rose-500'}`}>
                             {a.patientId.name[0]}
                          </div>
                          <div>
                             <span className="font-black text-white text-base block tracking-tight uppercase">{a.patientId.name}</span>
                             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(a.date).toDateString()} · {a.hospitalId.name}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          {a.status === 'declined' && <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/10">Declined</span>}
                          <StatusBadge status={a.status} />
                       </div>
                    </CardHeader>
                    {expandedAppointmentId === a._id && (
                      <CardContent className="p-6 pt-0 border-t border-white/5 bg-white/5 animate-in slide-in-from-top-2 duration-200">
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <div><span className="opacity-60 block mb-1">Email Dossier</span><span className="text-white">{a.patientId.email}</span></div>
                            <div><span className="opacity-60 block mb-1">Secure Line</span><span className="text-white">{a.patientId.phone || "N/A"}</span></div>
                            <div><span className="opacity-60 block mb-1">Encounter Ref</span><span className="text-white">#{a._id.slice(-8)}</span></div>
                            <div><span className="opacity-60 block mb-1">Settlement</span><span className="text-white">{a.paymentStatus}</span></div>
                         </div>
                         {a.status === 'completed' && (
                           <div className="pt-4 border-t border-white/5">
                              <Label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-widest">Clinical Memory</Label>
                              <div className="p-6 mt-2 rounded-[16px] bg-black/40 border border-white/5 text-sm text-slate-300 italic whitespace-pre-wrap leading-relaxed shadow-inner">
                                 "{a.doctorNotes || "No clinical observations recorded for this encounter."}"
                              </div>
                           </div>
                         )}
                         {a.status === 'declined' && a.declineReason && (
                           <div className="pt-4 border-t border-white/5">
                              <Label className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Decline Protocol Reason</Label>
                              <div className="p-6 mt-2 rounded-[16px] bg-rose-500/5 border border-rose-500/10 text-sm text-rose-200/70 italic leading-relaxed shadow-inner">
                                 "{a.declineReason}"
                              </div>
                           </div>
                         )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
