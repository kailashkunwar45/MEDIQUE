import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { useRouter } from "@/hooks/useRouter";
import { useSearchParams } from "@/hooks/useSearchParams";
import { Stethoscope, Clock, History, MessageSquare, ShieldCheck, Zap, Activity, Bell, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
function StatusBadge({ status }) {
    const map = {
        pending: "bg-amber-50 text-amber-600 border-amber-200",
        confirmed: "bg-emerald-50 text-emerald-600 border-emerald-200",
        completed: "bg-blue-50 text-blue-600 border-blue-200",
        cancelled: "bg-rose-50 text-rose-600 border-rose-200",
        declined: "bg-slate-50 text-slate-400 border-slate-200",
    };
    return <Badge className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${map[status]} shadow-sm`}>{status}</Badge>;
}
function getSession() {
    const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export default function DoctorDashboard() {
    const [session, setSession] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [openChatIds, setOpenChatIds] = useState([]);
    const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
    const [messagesMap, setMessagesMap] = useState({});
    const [chatTextMap, setChatTextMap] = useState({});
    const [noteText, setNoteText] = useState("");
    const [declineReason, setDeclineReason] = useState("");
    const [showDeclineInput, setShowDeclineInput] = useState(null);
    const [chatRequests, setChatRequests] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
    const socketRef = useRef(null);
    const globalSocketRef = useRef(null);
    const chatEndRefs = useRef({});
    const openChatIdsRef = useRef([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "requests");
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && ["requests", "chat-requests", "current", "past"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);
    const handleTabChange = (value) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", value);
        router.push(`/doctor?${params.toString()}`);
    };
    useEffect(() => {
        openChatIdsRef.current = openChatIds;
        openChatIds.forEach(id => {
            setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
        });
    }, [openChatIds]);
    useEffect(() => {
        const s = getSession();
        if (s && s.role !== "doctor") {
            window.location.href = `/${s.role}`;
            return;
        }
        setSession(s);
        if (s?.accessToken) {
            void loadUserData();
        }
    }, []);
    const loadUserData = async () => {
        try {
            const freshUser = await authFetch("/api/users/me");
            const s = getSession();
            if (s && freshUser) {
                const updated = { ...s, ...freshUser };
                localStorage.setItem("mediqueue_session", JSON.stringify(updated));
                setSession(updated);
            }
        }
        catch (e) {
            console.error("Failed to sync user data", e);
        }
    };
    useEffect(() => {
        if (!socketRef.current)
            return;
        const socket = socketRef.current;
        const handleMessage = (msg) => {
            setMessagesMap(prev => ({
                ...prev,
                [msg.appointmentId]: [...(prev[msg.appointmentId] || []), msg]
            }));
            setTimeout(() => {
                chatEndRefs.current[msg.appointmentId]?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        };
        socket.on("message", handleMessage);
        return () => { socket.off("message", handleMessage); };
    }, [socketRef.current]);
    const logout = () => {
        localStorage.removeItem("mediqueue_session");
        window.location.href = "/login";
    };
    const authFetch = async (path, init) => {
        const s = getSession();
        if (!s?.accessToken)
            throw new Error("Not logged in");
        const res = await fetch(`${path}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${s.accessToken}`,
                ...(init?.headers || {}),
            },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new Error(json?.message || `Request failed (${res.status})`);
        return json;
    };
    const loadAppointments = async () => {
        if (session?.isApprovedBySuperAdmin === false)
            return;
        setError("");
        setLoading(true);
        try {
            const data = await authFetch("/api/appointments/doctor");
            setAppointments(Array.isArray(data) ? data : []);
        }
        catch (e) {
            setError(e?.message || "Failed to load appointments");
        }
        finally {
            setLoading(false);
        }
    };
    const loadDoctorHospitals = async () => {
        if (session?.isApprovedBySuperAdmin === false)
            return;
        try {
            const s = getSession();
            if (!s)
                return;
            const res = await fetch(`/api/users/me`, {
                headers: { Authorization: `Bearer ${s.accessToken}` }
            });
            const data = await res.json();
            if (data.hospitalIds) {
                const hospitalData = await Promise.all(data.hospitalIds.map((id) => fetch(`/api/hospitals/detail?id=${id}`, {
                    headers: { Authorization: `Bearer ${s.accessToken}` }
                }).then(r => r.json().then(d => d.hospital))));
                setHospitals(hospitalData.filter(h => !!h));
            }
        }
        catch (e) {
            console.error("Failed to load hospitals", e);
        }
    };
    useEffect(() => {
        if (!session?.accessToken)
            return;
        void loadAppointments();
        void loadDoctorHospitals();
        void loadChatRequests();
        const socket = io();
        globalSocketRef.current = socket;
        socket.emit("registerUser", { token: session.accessToken });
        socket.on("messageNotification", (msg) => {
            if (!openChatIdsRef.current.includes(msg.appointmentId)) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [msg.appointmentId]: (prev[msg.appointmentId] || 0) + 1
                }));
            }
        });
        // Listen for fee update decisions from Super Admin
        socket.on("feeUpdateNotification", async (data) => {
            // Refresh session data from server to get the latest fee info
            try {
                const s = getSession();
                if (!s?.accessToken)
                    return;
                const res = await fetch(`/api/users/me`, {
                    headers: { Authorization: `Bearer ${s.accessToken}` }
                });
                const freshUser = await res.json();
                const updated = { ...s, appointmentFee: freshUser.appointmentFee, pendingFeeUpdate: freshUser.pendingFeeUpdate };
                localStorage.setItem("mediqueue_session", JSON.stringify(updated));
                setSession(updated);
            }
            catch { /* silent */ }
            const statusLabel = data.status === 'approved' ? '✅ APPROVED' : '❌ DECLINED';
            const reasonText = data.reason ? ` Reason: "${data.reason}"` : '';
            setInfo(`Fee request ${statusLabel}. New Fee: $${data.newFee}.${reasonText}`);
        });
        return () => {
            socket.disconnect();
        };
    }, [session?.accessToken]);
    const loadChatRequests = async () => {
        if (session?.isApprovedBySuperAdmin === false)
            return;
        try {
            const data = await authFetch("/api/chat/pending-requests");
            setChatRequests(Array.isArray(data) ? data : []);
        }
        catch (e) {
            console.error("Failed to load chat requests", e);
        }
    };
    const respondToChatRequest = async (connectionId, action) => {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/chat/respond", {
                method: "POST",
                body: JSON.stringify({ connectionId, action }),
            });
            setInfo(`Chat request ${action}d successfully.`);
            await loadChatRequests();
        }
        catch (e) {
            setError(e?.message || "Failed to respond");
        }
        finally {
            setLoading(false);
        }
    };
    const reconnectWithPatient = async (patientId) => {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/chat/reconnect", {
                method: "POST",
                body: JSON.stringify({ patientId }),
            });
            setInfo("Reconnected with patient. You can now chat.");
        }
        catch (e) {
            setError(e?.message || "Failed to reconnect");
        }
        finally {
            setLoading(false);
        }
    };
    const togglePaymentStatus = async (appointmentId) => {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch(`/api/appointments/${appointmentId}/payment-status`, { method: "PUT" });
            setInfo("Payment status updated.");
            await loadAppointments();
        }
        catch (e) {
            setError(e?.message || "Failed to update payment status");
        }
        finally {
            setLoading(false);
        }
    };
    const acceptAppointment = async (appointmentId) => {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/appointments/accept", { method: "POST", body: JSON.stringify({ appointmentId }) });
            setInfo("Appointment accepted! You can now chat with the patient.");
            await loadAppointments();
        }
        catch (e) {
            setError(e?.message || "Failed to accept");
        }
        finally {
            setLoading(false);
        }
    };
    const declineAppointment = async (appointmentId) => {
        if (!declineReason) {
            setError("Please provide a reason for declining.");
            return;
        }
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/appointments/decline", {
                method: "POST",
                body: JSON.stringify({ appointmentId, reason: declineReason })
            });
            setInfo("Appointment declined.");
            setShowDeclineInput(null);
            setDeclineReason("");
            await loadAppointments();
        }
        catch (e) {
            setError(e?.message || "Failed to decline");
        }
        finally {
            setLoading(false);
        }
    };
    const changeHospital = async (appointmentId, hospitalId) => {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/appointments/change-hospital", {
                method: "PUT",
                body: JSON.stringify({ appointmentId, hospitalId })
            });
            setInfo("Hospital updated. Patient has been notified.");
            await loadAppointments();
        }
        catch (e) {
            setError(e?.message || "Failed to change hospital");
        }
        finally {
            setLoading(false);
        }
    };
    const completeAppointment = async (appointmentId) => {
        if (!noteText || noteText.trim().length < 10) {
            setError("Please provide detailed clinical notes (min 10 chars) before completing.");
            return;
        }
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/appointments/complete", {
                method: "POST",
                body: JSON.stringify({ appointmentId, doctorNotes: noteText })
            });
            setInfo("Appointment marked as completed.");
            setNoteText("");
            setExpandedAppointmentId(null);
            await loadAppointments();
        }
        catch (e) {
            setError(e?.message || "Failed to complete");
        }
        finally {
            setLoading(false);
        }
    };
    const openChat = async (appointmentId) => {
        if (openChatIds.includes(appointmentId)) {
            setOpenChatIds(prev => prev.filter(id => id !== appointmentId));
            return;
        }
        setError("");
        if (!messagesMap[appointmentId]) {
            try {
                const history = await authFetch(`/api/chat/${appointmentId}/messages`);
                setMessagesMap(prev => ({ ...prev, [appointmentId]: history?.messages || [] }));
            }
            catch (e) {
                setError(e?.message || "Cannot load history");
            }
        }
        setOpenChatIds(prev => [...prev, appointmentId]);
        const s = getSession();
        if (!socketRef.current) {
            const socket = io();
            socketRef.current = socket;
        }
        socketRef.current.emit("joinChat", { appointmentId, token: s?.accessToken });
    };
    const sendChat = (appointmentId) => {
        const text = (chatTextMap[appointmentId] || "").trim();
        if (!appointmentId || !text || !socketRef.current)
            return;
        const s = getSession();
        socketRef.current.emit("sendMessage", { appointmentId, token: s?.accessToken, text });
        setChatTextMap(prev => ({ ...prev, [appointmentId]: "" }));
    };
    const [newFeeRequest, setNewFeeRequest] = useState("");
    const requestFeeUpdate = async () => {
        if (!newFeeRequest || isNaN(Number(newFeeRequest)))
            return;
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await authFetch("/api/users/request-fee-update", {
                method: "POST",
                body: JSON.stringify({ newFee: Number(newFeeRequest) })
            });
            setInfo("Fee update request submitted for Super Admin review.");
            setNewFeeRequest("");
            const s = getSession();
            if (s) {
                s.pendingFeeUpdate = { newFee: Number(newFeeRequest), status: 'pending', requestedAt: new Date() };
                localStorage.setItem("mediqueue_session", JSON.stringify(s));
                setSession(s);
            }
        }
        catch (e) {
            setError(e?.message || "Request failed");
        }
        finally {
            setLoading(false);
        }
    };
    const pending = appointments.filter((a) => a.status === "pending");
    const confirmed = appointments.filter((a) => a.status === "confirmed");
    const past = appointments.filter((a) => a.status === "completed");
    if (session && session.isApprovedBySuperAdmin === false) {
        return (<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-900">
        <Card className="max-w-md w-full rounded-[32px] border-none shadow-[0_20px_60px_rgba(15,23,42,0.1)] bg-white p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-[#1E3A8A]/5 border border-[#1E3A8A]/10 rounded-[24px] flex items-center justify-center mx-auto shadow-inner">
             <Stethoscope className="text-[#1E3A8A] w-12 h-12"/>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-[#0F172A] uppercase">Credential Review</h1>
            <p className="text-slate-500 font-bold leading-relaxed">Your specialist profile is currently under verification by the global medical board.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-[20px] border border-slate-100 text-[10px] font-black uppercase tracking-widest text-[#1E3A8A] italic">
            "Once authorized, you will gain access to your high-precision surgical and diagnostic terminal."
          </div>
          <Button variant="outline" className="w-full rounded-[16px] border-slate-200 hover:bg-slate-50 text-slate-900 font-black py-8 uppercase tracking-widest text-[10px]" onClick={() => { localStorage.removeItem("mediqueue_session"); window.location.href = "/login"; }}>
            Secure Sign Out
          </Button>
        </Card>
      </div>);
    }
    return (<div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <Navbar session={session}/>

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 space-y-8">
           <Card className="rounded-[24px] border border-slate-200 shadow-[0_10px_40px_rgba(15,23,42,0.05)] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest text-[#1E3A8A]">Clinical Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="flex items-center justify-between group">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Encounters</p>
                       <p className="text-4xl font-black text-[#0F172A] tracking-tighter">{confirmed.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-[16px] bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Activity className="text-emerald-500 w-6 h-6"/>
                    </div>
                 </div>
                 <div className="flex items-center justify-between group">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Protocols</p>
                       <p className="text-4xl font-black text-[#0F172A] tracking-tighter">{pending.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-[16px] bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Zap className="text-amber-500 w-6 h-6"/>
                    </div>
                 </div>
                 
                 <div className="pt-8 border-t border-slate-50 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Protocol</p>
                    <div className="p-5 rounded-[20px] bg-[#1E3A8A]/5 border border-[#1E3A8A]/10">
                       <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black text-[#1E3A8A] uppercase">Current Fee</span>
                          <span className="text-xl font-black text-[#0F172A]">${session?.appointmentFee || 0}</span>
                       </div>
                       
                       {session?.pendingFeeUpdate?.status === 'pending' ? (<div className="space-y-2">
                             <Badge className="w-full justify-center bg-amber-50 text-amber-600 border-amber-100 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest">Update Pending: ${session.pendingFeeUpdate.newFee}</Badge>
                             <p className="text-[8px] text-slate-400 font-bold uppercase text-center italic">Awaiting Super Admin Auth</p>
                          </div>) : session?.pendingFeeUpdate?.status === 'approved' ? (<div className="space-y-3 animate-in fade-in duration-500">
                            <div className="p-3 rounded-[14px] bg-emerald-50 border border-emerald-100 text-center">
                              <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600">✅ Fee Approved</p>
                              <p className="text-lg font-black text-emerald-700 mt-1">${session.pendingFeeUpdate.newFee}</p>
                              {session.pendingFeeUpdate.reason && (<p className="text-[8px] font-bold text-emerald-600/70 italic mt-1">"{session.pendingFeeUpdate.reason}"</p>)}
                            </div>
                            <Button className="w-full h-8 rounded-xl bg-slate-100 text-slate-500 font-black text-[8px] uppercase tracking-widest" onClick={() => { const s = getSession(); if (s) {
            s.pendingFeeUpdate = undefined;
            localStorage.setItem('mediqueue_session', JSON.stringify(s));
            setSession({ ...s });
        } }}>Request New Change</Button>
                          </div>) : session?.pendingFeeUpdate?.status === 'rejected' ? (<div className="space-y-3 animate-in fade-in duration-500">
                            <div className="p-3 rounded-[14px] bg-rose-50 border border-rose-100">
                              <p className="text-[8px] font-black uppercase tracking-widest text-rose-500">❌ Request Declined</p>
                              <p className="text-[9px] font-bold text-rose-400 mt-1">Requested: ${session.pendingFeeUpdate.newFee}</p>
                              {session.pendingFeeUpdate.reason && (<p className="text-[8px] font-bold text-rose-500/80 italic mt-2 leading-relaxed">Reason: "{session.pendingFeeUpdate.reason}"</p>)}
                            </div>
                            <div className="space-y-2">
                              <Input type="number" placeholder="New Fee" className="h-10 rounded-xl text-xs font-bold bg-white border-slate-200" value={newFeeRequest} onChange={(e) => setNewFeeRequest(e.target.value)}/>
                              <Button className="w-full h-10 rounded-xl bg-[#1E3A8A] text-white font-black text-[9px] uppercase tracking-widest shadow-lg" onClick={requestFeeUpdate} disabled={loading}>Re-Submit Request</Button>
                            </div>
                          </div>) : (<div className="space-y-3">
                             <Input type="number" placeholder="New Fee" className="h-10 rounded-xl text-xs font-bold bg-white border-slate-200" value={newFeeRequest} onChange={(e) => setNewFeeRequest(e.target.value)}/>
                             <Button className="w-full h-10 rounded-xl bg-[#1E3A8A] text-white font-black text-[9px] uppercase tracking-widest shadow-lg" onClick={requestFeeUpdate} disabled={loading}>
                                Request Update
                             </Button>
                          </div>)}
                    </div>
                 </div>

                 <div className="pt-8 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Load Distribution</p>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                             <span className="text-emerald-600">Confirmed Capacity</span>
                             <span className="text-[#0F172A]">{confirmed.length + pending.length > 0 ? Math.round((confirmed.length / (confirmed.length + pending.length)) * 100) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                             <div className="bg-[#1E3A8A] h-full transition-all duration-1000" style={{ width: `${(confirmed.length / (confirmed.length + pending.length || 1)) * 100}%` }}/>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-[16px] border border-slate-100">
                          <ShieldCheck className="w-4 h-4 text-[#D4AF37]"/>
                          <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Elite Tier Specialist</span>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-3 space-y-10">
          {error && <div className="p-6 bg-rose-50 text-rose-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-rose-100 shadow-sm animate-pulse">{error}</div>}
          {info && <div className="p-6 bg-emerald-50 text-emerald-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-emerald-100 shadow-sm">{info}</div>}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-10">
            <TabsList className="bg-white p-1 rounded-[16px] border border-slate-200 shadow-xl flex flex-wrap w-fit gap-1">
              <TabsTrigger value="requests" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                Requests {pending.length > 0 && `[${pending.length}]`}
              </TabsTrigger>
              <TabsTrigger value="chat-requests" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all relative">
                Chat Requests
                {chatRequests.length > 0 && (<span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{chatRequests.length}</span>)}
              </TabsTrigger>
              <TabsTrigger value="current" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                Active Encounters
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                Historical Archive
              </TabsTrigger>
            </TabsList>
            
            {selectedHistoryIds.length > 0 && (<Button variant="destructive" className="mt-4 rounded-[14px] px-6 py-6 font-bold transition-all shadow-sm shadow-rose-200" onClick={(e) => { e.stopPropagation(); deleteHistory(); }} disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2"/> Delete Selected ({selectedHistoryIds.length})
              </Button>)}

            <TabsContent value="requests" className="space-y-6">
              {pending.length === 0 ? (<div className="text-center py-32 bg-white rounded-[32px] border border-dashed border-slate-200 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="text-slate-300 w-10 h-10"/>
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Frequency Clear. No pending requests.</p>
                </div>) : (<div className="grid gap-6">
                  {pending.map((a) => (<Card key={a._id} className={`rounded-[24px] border-none shadow-[0_15px_40px_rgba(15,23,42,0.06)] bg-white overflow-hidden transition-all duration-500 ${expandedAppointmentId === a._id ? 'scale-[1.02] shadow-2xl ring-1 ring-[#1E3A8A]/10' : 'hover:scale-[1.01]'}`}>
                      <div className="flex flex-col md:flex-row">
                        <div className="p-8 md:w-2/3 space-y-6">
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[20px] bg-[#1E3A8A]/5 flex items-center justify-center text-3xl font-black text-[#1E3A8A] border border-[#1E3A8A]/10 shadow-inner">
                              {a.patientId.name[0]}
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-[#0F172A] tracking-tighter uppercase">{a.patientId.name}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encounter Sequence: {new Date(a.date).toLocaleDateString()}</p>
                                <StatusBadge status={a.status}/>
                              </div>
                            </div>
                          </div>

                          {expandedAppointmentId === a._id && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500 pt-4">
                               <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                                 <span className="text-[9px] text-slate-400 font-black uppercase block mb-2 tracking-widest">Patient Name</span>
                                 <span className="font-black text-[#0F172A] block truncate">{a.patientId.email}</span>
                               </div>
                               <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                                 <span className="text-[9px] text-slate-400 font-black uppercase block mb-2 tracking-widest">Contact</span>
                                 <span className="font-black text-[#0F172A]">{a.patientId.phone || "Offline"}</span>
                               </div>
                               <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-100 col-span-2 group hover:bg-white hover:shadow-lg transition-all">
                                 <span className="text-[9px] text-slate-400 font-black uppercase block mb-2 tracking-widest">Designated Facility</span>
                                 <div className="flex items-center justify-between gap-4">
                                   <span className="font-black text-[#1E3A8A] uppercase tracking-tight">{a.hospitalId.name}</span>
                                   {!a.hospitalLocked && hospitals.length > 1 && (<select className="text-[10px] bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#1E3A8A] uppercase outline-none shadow-sm cursor-pointer" value={a.hospitalId._id} onChange={(e) => changeHospital(a._id, e.target.value)}>
                                       {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                     </select>)}
                                 </div>
                               </div>
                               {showDeclineInput === a._id && (<div className="col-span-2 space-y-3 pt-2">
                                   <Label className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Revocation Justification</Label>
                                   <Input placeholder="Enter formal reason for protocol termination..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="rounded-[16px] h-14 bg-slate-50 border-slate-200 font-bold"/>
                                 </div>)}
                            </div>)}
                        </div>
                        
                        <div className="bg-slate-50/50 p-8 md:w-1/3 flex flex-col justify-center gap-4 border-l border-slate-100">
                          {expandedAppointmentId !== a._id ? (<Button className="w-full rounded-[18px] font-black uppercase text-[10px] tracking-[0.2em] bg-white text-[#1E3A8A] border border-slate-200 hover:bg-slate-50 py-8 shadow-sm transition-all" onClick={() => setExpandedAppointmentId(a._id)}>
                              Open Dossier
                            </Button>) : (<>
                              {showDeclineInput === a._id ? (<>
                                  <Button variant="ghost" className="rounded-[18px] font-black uppercase text-[10px] tracking-widest text-slate-400" onClick={() => setShowDeclineInput(null)}>Abort</Button>
                                  <Button className="w-full rounded-[18px] bg-rose-500 hover:bg-rose-600 font-black uppercase text-[10px] tracking-widest py-8 text-white shadow-xl shadow-rose-500/20" onClick={() => declineAppointment(a._id)}>Confirm Revoke</Button>
                                </>) : (<>
                                  <Button variant="outline" className="w-full rounded-[18px] font-black uppercase text-[10px] tracking-widest border-slate-200 py-8 text-slate-400 hover:bg-white" onClick={() => setShowDeclineInput(a._id)}>Revoke</Button>
                                  <Button className="w-full rounded-[18px] bg-[#1E3A8A] hover:bg-[#2563EB] font-black uppercase text-[10px] tracking-widest py-8 text-white shadow-xl gold-glow-hover" onClick={() => acceptAppointment(a._id)}>Authorize Encounter</Button>
                                </>)}
                            </>)}
                        </div>
                      </div>
                    </Card>))}
                </div>)}
            </TabsContent>

            <TabsContent value="chat-requests" className="space-y-6">
              {chatRequests.length === 0 ? (<div className="text-center py-32 bg-white rounded-[32px] border border-dashed border-slate-200 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageSquare className="text-slate-300 w-10 h-10"/>
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No pending chat requests.</p>
                </div>) : (<div className="grid gap-6">
                  {chatRequests.map((req) => (<Card key={req._id} className="rounded-[24px] border-none shadow-[0_15px_40px_rgba(15,23,42,0.06)] bg-white overflow-hidden transition-all hover:scale-[1.01]">
                      <div className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-[20px] bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-500 border border-indigo-100 shadow-inner">
                            {req.patientId.name[0]}
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-[#0F172A] tracking-tighter uppercase">{req.patientId.name}</h3>
                            <div className="flex flex-col mt-1 space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.patientId.email} · {req.patientId.phone || "No Phone"}</p>
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Wants to reconnect</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <Button variant="outline" className="rounded-[14px] border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 font-black uppercase text-[10px] tracking-widest px-6 py-6" onClick={() => respondToChatRequest(req._id, 'decline')} disabled={loading}>
                            Decline
                          </Button>
                          <Button className="rounded-[14px] bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-black uppercase text-[10px] tracking-widest px-8 py-6 shadow-xl gold-glow-hover" onClick={() => respondToChatRequest(req._id, 'approve')} disabled={loading}>
                            Accept
                          </Button>
                        </div>
                      </div>
                    </Card>))}
                </div>)}
            </TabsContent>

            <TabsContent value="current" className="space-y-8">
              {confirmed.length === 0 ? (<div className="text-center py-32 bg-white rounded-[32px] border border-dashed border-slate-200 shadow-sm">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Activity className="text-slate-300 w-10 h-10"/>
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No active clinical encounters.</p>
                </div>) : (<div className="grid gap-10">
                  {confirmed.map((a) => (<Card key={a._id} className="rounded-[32px] border-none shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden bg-white">
                      <div className="flex flex-col lg:flex-row">
                        <div className="p-10 lg:w-1/3 bg-slate-50/50 border-r border-slate-100 flex flex-col justify-between">
                          <div>
                             <div className="flex items-center gap-5 mb-8">
                                <div className="w-16 h-16 rounded-[20px] bg-emerald-500 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-emerald-500/20">
                                  {a.patientId.name[0]}
                                </div>
                                <div>
                                  <CardTitle className="text-xl font-black text-[#0F172A] uppercase tracking-tighter">{a.patientId.name}</CardTitle>
                                  <StatusBadge status={a.status}/>
                                </div>
                             </div>
                             <div className="space-y-5">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sequence ID</span>
                                   <span className="text-[11px] font-black text-[#0F172A] uppercase">#{a.tokenNumber || "AUTH-N/A"}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Hub</span>
                                   <Link to={`/hospitals/detail?id=${a.hospitalId._id}`} className="text-[11px] font-black text-[#1E3A8A] uppercase text-right hover:underline">
                                     {a.hospitalId.name}
                                   </Link>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Window</span>
                                   <span className="text-[11px] font-black text-[#0F172A] uppercase">{new Date(a.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement</span>
                                   <div className="flex items-center gap-2">
                                     <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-widest ${a.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                       {a.paymentStatus}
                                     </Badge>
                                     {a.paymentMethod === 'pay_later' && (<button onClick={() => togglePaymentStatus(a._id)} disabled={loading} className="p-1 rounded-full hover:bg-slate-100 transition-colors" title="Toggle Payment Status">
                                         <Activity className="w-3 h-3 text-slate-400"/>
                                       </button>)}
                                   </div>
                                </div>
                             </div>
                          </div>
                          
                          <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100">
                             <Button className="flex-1 w-full rounded-[14px] bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-black uppercase text-[10px] tracking-widest h-12 shadow-md relative px-2" onClick={() => openChat(a._id)}>
                               {openChatIds.includes(a._id) ? "Close Secure Chat" : "Chat to Patient"}
                               {!openChatIds.includes(a._id) && unreadCounts[a._id] > 0 && (<div className="absolute -top-2 -right-2 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full shadow-lg animate-bounce z-10 border-2 border-white">
                                   <Bell className="w-3 h-3 mr-0.5"/>
                                   {unreadCounts[a._id]}
                                 </div>)}
                             </Button>
                             <Button className="flex-1 w-full rounded-[14px] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-black uppercase text-[10px] tracking-widest h-12 px-2" onClick={() => setExpandedAppointmentId(expandedAppointmentId === a._id ? null : a._id)}>
                               {expandedAppointmentId === a._id ? "Close Panel" : "Conclude Encounter"}
                             </Button>
                          </div>
                        </div>

                         <div className="flex-1 flex flex-col bg-white">
                          {openChatIds.includes(a._id) ? (<div className="flex flex-col h-[600px]">
                              <div className="bg-slate-50/30 p-6 border-b border-slate-100 flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chat: Secured</span>
                                 </div>
                                 <MessageSquare className="w-4 h-4 text-slate-300"/>
                              </div>
                              <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-[url('/grid.svg')] bg-repeat">
                                 {(!messagesMap[a._id] || messagesMap[a._id].length === 0) ? (<div className="flex flex-col items-center justify-center h-full opacity-30">
                                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                         <MessageSquare className="w-8 h-8 text-slate-400"/>
                                      </div>
                                      <p className="text-[10px] font-black uppercase tracking-widest">Await transmission...</p>
                                   </div>) : (messagesMap[a._id].map((m) => {
                        const isMe = String(m.senderId) === String(session?._id);
                        return (<div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                         <div className={`max-w-[80%] p-5 rounded-[24px] text-sm shadow-sm border ${isMe ? "bg-[#1E3A8A] text-white rounded-tr-none border-[#1E3A8A]/10" : "bg-white text-[#0F172A] rounded-tl-none border-slate-100"}`}>
                                            {!isMe && <div className="text-[9px] font-black opacity-40 uppercase mb-2 tracking-widest">{m.senderRole}</div>}
                                            <div className="font-medium leading-relaxed">{m.text}</div>
                                            <div className={`text-[8px] mt-3 font-black opacity-30 uppercase tracking-tighter ${isMe ? "text-right" : ""}`}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                         </div>
                                       </div>);
                    }))}
                                 <div ref={(el) => { chatEndRefs.current[a._id] = el; }}/>
                              </div>
                              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                                 <Input placeholder="Type a message..." value={chatTextMap[a._id] || ""} onChange={(e) => setChatTextMap(prev => ({ ...prev, [a._id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && sendChat(a._id)} className="rounded-[18px] h-16 bg-white border-slate-200 font-bold px-6 shadow-inner"/>
                                 <Button onClick={() => sendChat(a._id)} className="rounded-[18px] h-16 px-10 font-black bg-[#1E3A8A] hover:bg-[#2563EB] text-white shadow-lg gold-glow-hover">CHAT</Button>
                              </div>
                            </div>) : expandedAppointmentId === a._id ? (<div className="p-12 flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-500">
                                <div className="space-y-6">
                                   <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-[14px] flex items-center justify-center">
                                         <ShieldCheck className="text-[#D4AF37] w-6 h-6"/>
                                      </div>
                                      <h3 className="text-2xl font-black text-[#0F172A] uppercase tracking-tighter">Conclude Encounter</h3>
                                   </div>
                                   <p className="text-sm text-slate-500 font-bold leading-relaxed">Enter mandatory session notes, diagnostic findings, and prescriptions to finalize this patient's medical record.</p>
                                   <textarea className="w-full h-72 rounded-[24px] bg-slate-50 border border-slate-100 focus:border-[#1E3A8A]/30 focus:bg-white p-8 text-sm text-[#0F172A] font-medium resize-none transition-all outline-none shadow-inner" placeholder="Symptoms identified, diagnostic findings, prescriptions authorized, and protocol recommendations..." value={noteText} onChange={(e) => setNoteText(e.target.value)} required/>
                                </div>
                                <Button className="w-full h-20 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] bg-[#1E3A8A] hover:bg-[#2563EB] text-white shadow-2xl gold-glow-hover mt-10" onClick={() => completeAppointment(a._id)}>
                                  Save Record & Complete
                                </Button>
                             </div>) : (<div className="flex-1 flex items-center justify-center p-20 text-center bg-[url('/grid.svg')] bg-repeat opacity-40">
                              <div className="max-w-[400px] space-y-8">
                                <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto border border-slate-100 shadow-xl">
                                  <Stethoscope className="text-slate-200 w-12 h-12"/>
                                </div>
                                <p className="text-slate-400 font-bold text-sm italic leading-loose">"Precision in diagnosis, excellence in care. Utilize the secure terminal to synchronize with patient and archive medical data."</p>
                                <div className="pt-6 flex items-center justify-center gap-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">
                                   <span className="bg-slate-50 px-4 py-2 rounded-full border border-slate-100">Subject: {a.patientId.name}</span>
                                   <span className="bg-slate-50 px-4 py-2 rounded-full border border-slate-100">Ref: {a._id.slice(-6).toUpperCase()}</span>
                                </div>
                              </div>
                            </div>)}
                        </div>
                      </div>
                    </Card>))}
                </div>)}
            </TabsContent>

            {/* PAST TAB */}
            <TabsContent value="past" className="space-y-6">
               {past.length === 0 ? (<div className="text-center py-32 bg-white rounded-[32px] border border-dashed border-slate-200 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <History className="text-slate-300 w-10 h-10"/>
                  </div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Archive empty. No historical encounters.</p>
                </div>) : (<div className="grid gap-4">
                  {past.map((a) => (<Card key={a._id} className={`rounded-[24px] border ${selectedHistoryIds.includes(a._id) ? 'border-rose-400 bg-rose-50/20' : 'border-slate-100 bg-white'} shadow-sm hover:shadow-xl transition-all cursor-pointer group`} onClick={() => setExpandedAppointmentId(expandedAppointmentId === a._id ? null : a._id)}>
                      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                         <div className="flex items-center gap-5">
                            <div className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${selectedHistoryIds.includes(a._id) ? 'bg-rose-500 border-rose-500' : 'bg-white border-slate-300'}`} onClick={(e) => toggleHistorySelection(a._id, e)}>
                              {selectedHistoryIds.includes(a._id) && <div className="w-3 h-3 bg-white rounded-sm"/>}
                            </div>
                            <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center font-black text-xl shadow-inner border ${a.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                               {a.patientId.name[0]}
                            </div>
                            <div>
                               <span className="font-black text-[#0F172A] text-lg block tracking-tight uppercase group-hover:text-[#1E3A8A] transition-colors">{a.patientId.name}</span>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(a.date).toDateString()} · {a.hospitalId.name}</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            {a.status === 'declined' && <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest text-rose-500 border-rose-100 bg-rose-50 px-3 py-1">Declined</Badge>}
                            <StatusBadge status={a.status}/>
                         </div>
                      </div>
                      {expandedAppointmentId === a._id && (<div className="p-10 pt-4 border-t border-slate-50 bg-slate-50/30 animate-in slide-in-from-top-4 duration-500 rounded-b-[24px]">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <div className="space-y-2"><span className="opacity-60 block">Identity Link</span><span className="text-[#0F172A] block truncate">{a.patientId.email}</span></div>
                              <div className="space-y-2"><span className="opacity-60 block">Secure Line</span><span className="text-[#0F172A]">{a.patientId.phone || "N/A"}</span></div>
                              <div className="space-y-2"><span className="opacity-60 block">Archive Ref</span><span className="text-[#1E3A8A]">#{a._id.slice(-8).toUpperCase()}</span></div>
                              <div className="space-y-2"><span className="opacity-60 block">Settlement Status</span><span className="text-emerald-600">{a.paymentStatus}</span></div>
                           </div>
                           {a.status === 'completed' && (<>
                               <div className="pt-8 border-t border-slate-100">
                                  <Label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.2em] mb-4 block">Clinical Archive Data</Label>
                                  <div className="p-8 rounded-[24px] bg-white border border-slate-100 text-sm text-slate-600 italic whitespace-pre-wrap leading-loose shadow-inner">
                                     "{a.doctorNotes || "No clinical data was archived for this encounter sequence."}"
                                  </div>
                               </div>
                               <div className="pt-6 mt-4 flex justify-end gap-3">
                                 <Button variant="outline" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); deleteHistory([a._id]); }} disabled={loading}>
                                   <Trash2 className="w-4 h-4 mr-2"/> Delete
                                 </Button>
                                 <Button className="rounded-[14px] font-black uppercase text-[10px] tracking-widest bg-[#1E3A8A] text-white shadow-md hover:bg-[#2563EB]" onClick={(e) => { e.stopPropagation(); reconnectWithPatient(a.patientId._id); }} disabled={loading}>
                                   Reconnect & Chat
                                 </Button>
                               </div>
                             </>)}
                           {a.status !== 'completed' && (<div className="pt-6 mt-6 flex justify-end">
                                <Button variant="outline" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); deleteHistory([a._id]); }} disabled={loading}>
                                  <Trash2 className="w-4 h-4 mr-2"/> Delete Record
                                </Button>
                             </div>)}
                           {a.status === 'declined' && a.declineReason && (<div className="pt-8 border-t border-slate-100">
                                <Label className="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em] mb-4 block">Termination Reason</Label>
                                <div className="p-8 rounded-[24px] bg-rose-50/50 border border-rose-100 text-sm text-rose-400 italic leading-loose shadow-inner">
                                   "{a.declineReason}"
                                </div>
                             </div>)}
                        </div>)}
                    </Card>))}
                </div>)}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>);
}
