"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  ShieldCheck, 
  Stethoscope, 
  Building, 
  PieChart as ChartIcon, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  MessageSquare
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

type Hospital = {
  _id: string;
  name: string;
  address: string;
  certification: string;
  isApprovedBySuperAdmin: boolean;
  isBanned: boolean;
};

type Doctor = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string;
  bio?: string;
  degree?: string;
  experienceYears?: number;
  college?: string;
  isApprovedBySuperAdmin: boolean;
  isBanned: boolean;
  hospitalIds: { name: string }[];
  appointmentFee?: number;
  pendingFeeUpdate?: {
    newFee: number;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
  };
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [pendingHospitals, setPendingHospitals] = useState<Hospital[]>([]);
  const [approvedHospitals, setApprovedHospitals] = useState<Hospital[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<Doctor[]>([]);
  const [approvedDoctors, setApprovedDoctors] = useState<Doctor[]>([]);
  const [feeRequests, setFeeRequests] = useState<Doctor[]>([]);
  const [viewingDoctor, setViewingDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rejectingFeeFor, setRejectingFeeFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("mediqueue_session");
    window.location.href = "/login";
  };

  const authFetch = async (path: string, init?: RequestInit) => {
    const session = JSON.parse(localStorage.getItem("mediqueue_session") || "{}");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        ...(init?.headers || {}),
      },
    });
    return res.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, pHospitals, aHospitals, pDoctors, aDoctors, fRequests] = await Promise.all([
        authFetch("/api/super-admin/stats"),
        authFetch("/api/super-admin/hospitals/pending"),
        authFetch("/api/super-admin/hospitals/approved"),
        authFetch("/api/super-admin/doctors/pending"),
        authFetch("/api/super-admin/doctors/approved"),
        authFetch("/api/superadmin/doctors/fees/pending"),
      ]);

      setStats(statsData);
      setPendingHospitals(pHospitals || []);
      setApprovedHospitals(aHospitals || []);
      setPendingDoctors(pDoctors || []);
      setApprovedDoctors(aDoctors || []);
      setFeeRequests(fRequests || []);
    } catch (e) {
      setError("Failed to sync global data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleHospitalApproval = async (hospitalId: string, status: "approved" | "rejected") => {
    try {
      await authFetch("/api/super-admin/hospitals/approve", {
        method: "POST",
        body: JSON.stringify({ hospitalId, status }),
      });
      loadData();
    } catch (e) { setError("Hospital action failed"); }
  };

  const handleRemoveHospital = async (hospitalId: string) => {
    if (!confirm("Are you sure you want to PERMANENTLY remove this hospital?")) return;
    try {
      await authFetch(`/api/super-admin/hospitals/detail?id=${hospitalId}`, { method: "DELETE" });
      loadData();
    } catch (e) { setError("Remove hospital failed"); }
  };

  const handleBanHospital = async (hospitalId: string, currentBanStatus: boolean) => {
    const reason = !currentBanStatus ? prompt("Enter ban reason:") : "";
    if (!currentBanStatus && !reason) return;
    try {
      await authFetch("/api/super-admin/hospitals/ban", {
        method: "POST",
        body: JSON.stringify({ hospitalId, isBanned: !currentBanStatus, reason }),
      });
      loadData();
    } catch (e) { setError("Ban action failed"); }
  };

  const handleDoctorApproval = async (doctorId: string, status: "approved" | "rejected") => {
    try {
      await authFetch("/api/super-admin/doctors/approve", {
        method: "POST",
        body: JSON.stringify({ doctorId, status }),
      });
      loadData();
    } catch (e) { setError("Doctor action failed"); }
  };

  const handleRemoveDoctor = async (doctorId: string) => {
    if (!confirm("Are you sure you want to PERMANENTLY remove this doctor?")) return;
    try {
      await authFetch(`/api/super-admin/doctors?id=${doctorId}`, { method: "DELETE" });
      loadData();
    } catch (e) { setError("Remove doctor failed"); }
  };

  const handleBanDoctor = async (doctorId: string, currentBanStatus: boolean) => {
    const reason = !currentBanStatus ? prompt("Enter ban reason:") : "";
    if (!currentBanStatus && !reason) return;
    try {
      await authFetch("/api/super-admin/doctors/ban", {
        method: "POST",
        body: JSON.stringify({ userId: doctorId, isBanned: !currentBanStatus, reason }),
      });
      loadData();
    } catch (e) { setError("Ban action failed"); }
  };

  const handleFeeApproval = async (doctorId: string, status: 'approved' | 'rejected', reason?: string) => {
    if (status === 'rejected' && !reason) {
      // Start the inline rejection flow instead
      setRejectingFeeFor(doctorId);
      setRejectReason("");
      return;
    }
    try {
      setError(""); setInfo("");
      await authFetch("/api/superadmin/doctors/fees/approve", {
        method: "POST",
        body: JSON.stringify({ doctorId, status, reason }),
      });
      setInfo(`Fee update ${status} and doctor notified.`);
      setRejectingFeeFor(null);
      setRejectReason("");
      loadData();
    } catch (e) { setError("Fee action failed"); }
  };

  const simulateBulkUpdate = async () => {
    setLoading(true);
    try {
      await authFetch('/api/superadmin/doctors/fees/bulk-request', {
        method: 'POST',
        body: JSON.stringify({ newFee: 150 })
      });
      setInfo("Global fee review simulation initiated for all specialists.");
      loadData();
    } catch (e: any) { setError(e.message || "Bulk update failed"); }
    finally { setLoading(false); }
  };

  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6B7280'];
  const appointmentPieData = stats?.appointments?.mix ? 
    Object.entries(stats.appointments.mix).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <div className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200 px-8 py-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 rounded-[20px] bg-white flex items-center justify-center shadow-xl border border-slate-100 p-2">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tighter text-[#0F172A] uppercase">MediQueue</h1>
                <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase opacity-70 mt-0.5">
                  Platform Oversight: <span className="text-[#1E3A8A] font-black">Global Super Admin</span>
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm" onClick={loadData}>Sync Global State</Button>
              <Button variant="ghost" className="rounded-[14px] px-6 py-6 font-bold text-rose-500 hover:bg-rose-50 transition-all" onClick={logout}>
                Log Out
              </Button>
              <Link href="/profile">
                 <Button className="rounded-[14px] px-8 py-6 font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] shadow-xl transition-all scale-95 hover:scale-100 gold-glow-hover">System Command</Button>
              </Link>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-10">
        {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-rose-100">{error}</div>}

        <Tabs defaultValue="stats" className="space-y-8">
           <TabsList className="bg-white p-1 rounded-[16px] border border-slate-200 shadow-xl flex w-fit">
              <TabsTrigger value="stats" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                 <ChartIcon className="w-4 h-4 mr-2" /> Intelligence
              </TabsTrigger>
              <TabsTrigger value="hospitals" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                 <Building className="w-4 h-4 mr-2" /> Facilities
              </TabsTrigger>
              <TabsTrigger value="doctors" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                 <Stethoscope className="w-4 h-4 mr-2" /> Specialists
              </TabsTrigger>
              <TabsTrigger value="fees" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                 <Zap className="w-4 h-4 mr-2" /> Fee Requests {feeRequests.length > 0 && `[${feeRequests.length}]`}
              </TabsTrigger>
           </TabsList>

           <TabsContent value="stats" className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: "Global Facilities", val: stats?.hospitals, icon: Building, col: "text-[#1E3A8A]", bg: "bg-[#1E3A8A]/5" },
                   { label: "Elite Specialists", val: stats?.doctors, icon: Stethoscope, col: "text-[#D4AF37]", bg: "bg-[#D4AF37]/10" },
                   { label: "Patient Network", val: stats?.patients, icon: ShieldCheck, col: "text-[#1E3A8A]", bg: "bg-[#1E3A8A]/5" },
                   { label: "Total Bookings", val: stats?.appointments?.total, icon: ChartIcon, col: "text-[#D4AF37]", bg: "bg-[#D4AF37]/10" },
                 ].map((s, i) => (
                   <Card key={i} className="rounded-[20px] border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.05)] bg-white p-6 hover:scale-105 transition-all">
                      <div className={`w-12 h-12 rounded-[14px] ${s.bg} flex items-center justify-center mb-4`}>
                         <s.icon className={`${s.col} w-6 h-6`} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <p className="text-3xl font-black text-[#0F172A] mt-1 tracking-tight">{s.val || 0}</p>
                   </Card>
                 ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card className="rounded-[20px] border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.05)] bg-white p-8">
                    <CardTitle className="text-xl font-black text-[#0F172A] mb-6 uppercase tracking-tight">Encounter Mix (Global)</CardTitle>
                    <div className="h-[350px]">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                             <Pie data={appointmentPieData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                                {appointmentPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                             </Pie>
                             <Tooltip />
                             <Legend />
                          </PieChart>
                       </ResponsiveContainer>
                    </div>
                 </Card>

                 <Card className="rounded-[20px] border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.05)] bg-white p-8">
                    <CardTitle className="text-xl font-black text-[#0F172A] mb-6 uppercase tracking-tight">Network Distribution</CardTitle>
                    <div className="h-[350px]">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                             { name: 'Facilities', val: stats?.hospitals || 0 },
                             { name: 'Personnel', val: stats?.doctors || 0 },
                             { name: 'Patients', val: (stats?.patients || 0) / 1000 },
                          ]}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                             <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                             <Tooltip />
                             <Bar dataKey="val" fill="#1E3A8A" radius={[8, 8, 0, 0]} barSize={40} />
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                 </Card>
              </div>
           </TabsContent>

           <TabsContent value="hospitals" className="space-y-10">
              <div className="space-y-6">
                 <div className="flex items-center gap-3 px-2 text-amber-600">
                    <AlertCircle className="w-5 h-5" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Pending Certification</h3>
                 </div>
                 {pendingHospitals.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px]">No pending facility registrations.</div>
                 ) : (
                    <div className="grid gap-6">
                       {pendingHospitals.map(h => (
                          <Card key={h._id} className="rounded-[20px] border-none shadow-[0_10px_40px_rgba(15,23,42,0.08)] bg-white overflow-hidden hover:scale-[1.01] transition-all">
                             <CardContent className="p-0 flex flex-col md:flex-row">
                                <div className="p-8 md:w-2/3">
                                   <p className="text-2xl font-black text-[#0F172A] tracking-tight uppercase">{h.name}</p>
                                   <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{h.address}</p>
                                   <div className="mt-6 inline-flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-[12px] text-[10px] font-black text-[#1E3A8A] border border-slate-100 uppercase tracking-widest">
                                      Protocol Status: {h.certification || "Awaiting Verification"}
                                   </div>
                                </div>
                                <div className="bg-slate-50 p-8 md:w-1/3 flex items-center justify-end gap-3 border-l border-slate-100">
                                   <Button variant="ghost" className="font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-rose-500" onClick={() => handleHospitalApproval(h._id, "rejected")}>Revoke</Button>
                                   <Button className="font-black bg-[#1E3A8A] hover:bg-[#2563EB] text-white rounded-[14px] px-8 h-12 uppercase tracking-widest text-[10px] gold-glow-hover" onClick={() => handleHospitalApproval(h._id, "approved")}>Authorize Facility</Button>
                                </div>
                             </CardContent>
                          </Card>
                       ))}
                    </div>
                 )}
              </div>

              <div className="space-y-6">
                 <div className="flex items-center gap-3 px-2 text-[#10B981]">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Verified Command Network</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {approvedHospitals.map(h => (
                       <Card key={h._id} className={`rounded-[20px] border shadow-sm bg-white p-6 transition-all ${h.isBanned ? 'border-rose-100 bg-rose-50/20' : 'border-slate-100'}`}>
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="font-black text-[#0F172A] text-lg tracking-tight uppercase">{h.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">ID: #{h._id.slice(-6).toUpperCase()}</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{h.address}</p>
                             </div>
                             {h.isBanned && <Badge className="bg-rose-500 text-white font-black text-[9px] uppercase tracking-widest rounded-full">Protocol Banned</Badge>}
                          </div>
                          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-50 pt-4">
                             <Button variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 px-3" onClick={() => handleBanHospital(h._id, h.isBanned)}>
                                {h.isBanned ? 'Restore' : 'Suspend'}
                             </Button>
                             <Button variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 px-3" onClick={() => handleRemoveHospital(h._id)}>
                                Terminate
                             </Button>
                          </div>
                          <Badge className="mt-4 bg-[#D4AF37]/10 text-[#D4AF37] border-none rounded-full font-black uppercase text-[9px] tracking-widest px-3">Elite Tier Partner</Badge>
                       </Card>
                    ))}
                 </div>
              </div>
           </TabsContent>

           <TabsContent value="doctors" className="space-y-10">
              <div className="space-y-6">
                 <div className="flex items-center gap-3 px-2 text-amber-600">
                    <AlertCircle className="w-5 h-5" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Credential Verification</h3>
                 </div>
                 {pendingDoctors.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px]">All specialist credentials verified.</div>
                 ) : (
                    <div className="grid gap-6">
                       {pendingDoctors.map(d => (
                          <Card key={d._id} className="rounded-[20px] border-none shadow-[0_10px_40px_rgba(15,23,42,0.08)] bg-white p-8 flex items-center justify-between flex-wrap gap-6">
                             <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[20px] bg-[#1E3A8A]/10 flex items-center justify-center text-3xl font-black text-[#1E3A8A] uppercase shadow-inner border border-[#1E3A8A]/5">
                                   {d.name[0]}
                                </div>
                                <div>
                                   <p className="text-2xl font-black text-[#0F172A] tracking-tight uppercase">Dr. {d.name}</p>
                                   <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mt-1">{d.specialization}</p>
                                   <div className="flex flex-wrap gap-2 mt-4">
                                      {d.hospitalIds?.map((h: any, idx: number) => (
                                         <span key={idx} className="text-[9px] font-black uppercase bg-slate-50 px-3 py-1 rounded-full text-slate-500 border border-slate-100 tracking-widest">{h.name}</span>
                                      ))}
                                   </div>
                                </div>
                             </div>
                             <div className="flex gap-3">
                                 <Button variant="outline" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest border-slate-200 h-12 px-6" onClick={() => setViewingDoctor(d)}>Dossier</Button>
                                 <Button variant="outline" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest border-rose-100 text-rose-500 hover:bg-rose-50 h-12 px-6" onClick={() => handleDoctorApproval(d._id, "rejected")}>Fail</Button>
                                 <Button className="rounded-[14px] font-black uppercase text-[10px] tracking-widest bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-10 h-12 shadow-xl gold-glow-hover" onClick={() => handleDoctorApproval(d._id, "approved")}>Authorize</Button>
                              </div>
                           </Card>
                        ))}
                     </div>
                  )}

                  {viewingDoctor && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                       <Card className="w-full max-w-2xl rounded-3xl border-none shadow-2xl bg-white overflow-hidden animate-in fade-in zoom-in duration-300">
                          <div className="p-8 space-y-6">
                             <div className="flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                   <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-600 uppercase">
                                      {viewingDoctor.name[0]}
                                   </div>
                                   <div>
                                      <h2 className="text-3xl font-black text-slate-900">Dr. {viewingDoctor.name}</h2>
                                      <p className="text-lg font-bold text-indigo-600">{viewingDoctor.specialization}</p>
                                   </div>
                                </div>
                                <Button variant="ghost" className="rounded-full w-10 h-10 p-0" onClick={() => setViewingDoctor(null)}>✕</Button>
                             </div>

                             <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Education</p>
                                   <p className="font-bold text-slate-800">{viewingDoctor.degree} from {viewingDoctor.college}</p>
                                </div>
                                <div className="space-y-1">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</p>
                                   <p className="font-bold text-slate-800">{viewingDoctor.experienceYears} Years</p>
                                </div>
                                <div className="space-y-1">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                                   <p className="font-bold text-slate-800">{viewingDoctor.email}</p>
                                </div>
                                <div className="space-y-1">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                                   <p className="font-bold text-slate-800">{viewingDoctor.phone || "N/A"}</p>
                                </div>
                             </div>

                             <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biography / About</p>
                                <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl italic border border-slate-100">
                                   "{viewingDoctor.bio || "No biography provided."}"
                                </p>
                             </div>

                             <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Affiliated Hospitals</p>
                                <div className="flex flex-wrap gap-2">
                                   {viewingDoctor.hospitalIds?.map((h: any, idx: number) => (
                                      <Badge key={idx} className="bg-indigo-50 text-indigo-600 border-indigo-100 px-3 py-1 rounded-xl font-bold uppercase text-[10px]">{h.name}</Badge>
                                   ))}
                                </div>
                             </div>

                             <div className="pt-6 border-t border-slate-100 flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-2xl font-bold border-slate-200" onClick={() => setViewingDoctor(null)}>Close Profile</Button>
                                <Button className="flex-1 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20" onClick={() => { handleDoctorApproval(viewingDoctor._id, "approved"); setViewingDoctor(null); }}>Verify Credentials</Button>
                             </div>
                          </div>
                       </Card>
                    </div>
                  )}
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-3 px-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Active Medical Staff</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {approvedDoctors.map(d => (
                       <Card key={d._id} className={`rounded-3xl border shadow-md bg-white p-6 ${d.isBanned ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'}`}>
                          <div className="flex items-center gap-3 mb-4">
                             <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">{d.name[0]}</div>
                             <div className="flex-1">
                                <div className="flex items-center justify-between">
                                   <p className="font-black text-slate-900 leading-tight">Dr. {d.name}</p>
                                   {d.isBanned && <Badge className="bg-rose-500 text-white font-black text-[8px] uppercase">BANNED</Badge>}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{d.specialization}</p>
                                <p className="text-[9px] font-bold text-slate-300">ID: #{d._id.slice(-6).toUpperCase()}</p>
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 mb-4">
                             <Button variant="ghost" className="h-7 text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-2" onClick={() => handleBanDoctor(d._id, d.isBanned)}>
                                {d.isBanned ? 'Unban' : 'Ban'}
                             </Button>
                             <Button variant="ghost" className="h-7 text-[10px] font-bold text-slate-400 hover:text-rose-600 px-2" onClick={() => handleRemoveDoctor(d._id)}>
                                Remove
                             </Button>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-none rounded-full font-bold uppercase text-[10px]">CREDENTIALS VERIFIED</Badge>
                       </Card>
                    ))}
                 </div>
              </div>
           </TabsContent>

           <TabsContent value="fees" className="space-y-8">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-3 text-[#1E3A8A]">
                      <Zap className="w-5 h-5" />
                      <h3 className="text-xl font-black uppercase tracking-tight">Financial Protocol Authorizations</h3>
                   </div>
                   <Button variant="outline" className="rounded-[14px] px-6 py-4 font-black border-[#D4AF37]/30 text-[#1E3A8A] hover:bg-[#D4AF37]/5 transition-all shadow-sm flex items-center gap-2" onClick={simulateBulkUpdate}>
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Simulate Global Fee Review ($150)
                   </Button>
                </div>

                {/* Pending Requests */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending Authorization</p>
                  </div>
                  {feeRequests.filter(d => d.pendingFeeUpdate?.status === 'pending').length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px]">No pending fee adjustments.</div>
                  ) : (
                    <div className="grid gap-6">
                      {feeRequests.filter(d => d.pendingFeeUpdate?.status === 'pending').map(d => (
                        <Card key={d._id} className="rounded-[20px] border border-amber-100 shadow-[0_10px_40px_rgba(15,23,42,0.06)] bg-white overflow-hidden">
                          <div className="flex items-start justify-between flex-wrap gap-6 p-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-[18px] bg-[#1E3A8A]/5 flex items-center justify-center text-2xl font-black text-[#1E3A8A] uppercase border border-[#1E3A8A]/10">
                                {d.name[0]}
                              </div>
                              <div>
                                <p className="text-xl font-black text-[#0F172A] tracking-tight uppercase">Dr. {d.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{d.specialization}</p>
                                <div className="mt-4 flex items-center gap-6">
                                  <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Current Fee</p>
                                    <p className="text-lg font-black text-slate-400">${d.appointmentFee || 0}</p>
                                  </div>
                                  <div className="w-px h-8 bg-slate-100" />
                                  <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Requested Fee</p>
                                    <p className="text-2xl font-black text-amber-600">${d.pendingFeeUpdate?.newFee}</p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Requested On</p>
                                    <p className="text-[11px] font-black text-slate-500">{d.pendingFeeUpdate?.requestedAt ? new Date(d.pendingFeeUpdate.requestedAt).toLocaleDateString() : 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 min-w-[200px]">
                              {rejectingFeeFor === d._id ? (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Rejection Reason (Required)</p>
                                  <textarea
                                    className="w-full text-xs font-bold border border-rose-200 rounded-[14px] p-3 bg-rose-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                                    placeholder="Provide a clear reason for declining this request..."
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button variant="ghost" className="flex-1 rounded-[12px] font-black uppercase text-[9px] tracking-widest text-slate-400 h-10" onClick={() => { setRejectingFeeFor(null); setRejectReason(''); }}>Cancel</Button>
                                    <Button
                                      className="flex-1 rounded-[12px] bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[9px] tracking-widest h-10 shadow-lg"
                                      disabled={!rejectReason.trim()}
                                      onClick={() => handleFeeApproval(d._id, 'rejected', rejectReason.trim())}
                                    >Confirm Rejection</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Button variant="ghost" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-rose-500 h-12 px-6 border border-rose-100 hover:bg-rose-50" onClick={() => setRejectingFeeFor(d._id)}>Decline Request</Button>
                                  <Button className="rounded-[14px] font-black uppercase text-[10px] tracking-widest bg-[#1E3A8A] hover:bg-[#2563EB] text-white h-12 shadow-xl gold-glow-hover" onClick={() => handleFeeApproval(d._id, 'approved', undefined)}>Approve Fee Change</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Decision History */}
                {feeRequests.filter(d => d.pendingFeeUpdate?.status !== 'pending').length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 pt-4 border-t border-slate-100">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Decision History</p>
                    </div>
                    <div className="grid gap-4">
                      {feeRequests.filter(d => d.pendingFeeUpdate?.status !== 'pending').map(d => {
                        const isApproved = d.pendingFeeUpdate?.status === 'approved';
                        return (
                          <div key={d._id} className={`rounded-[18px] border p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${
                            isApproved ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
                          }`}>
                            <div className="flex items-center gap-5">
                              <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center text-xl font-black uppercase border ${
                                isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                              }`}>{d.name[0]}</div>
                              <div>
                                <p className="font-black text-[#0F172A] uppercase tracking-tight">Dr. {d.name}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{d.specialization}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Old: ${d.appointmentFee || 0}</span>
                                  <span className="text-slate-300">→</span>
                                  <span className={`text-[11px] font-black uppercase tracking-widest ${
                                    isApproved ? 'text-emerald-600' : 'text-rose-500 line-through'
                                  }`}>${d.pendingFeeUpdate?.newFee}</span>
                                </div>
                                {d.pendingFeeUpdate?.reason && (
                                  <div className={`mt-2 flex items-start gap-2 p-2 rounded-[10px] border ${
                                    isApproved ? 'bg-emerald-100/50 border-emerald-200' : 'bg-rose-100/50 border-rose-200'
                                  }`}>
                                    <MessageSquare className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isApproved ? 'text-emerald-600' : 'text-rose-500'}`} />
                                    <p className={`text-[9px] font-bold italic ${
                                      isApproved ? 'text-emerald-700' : 'text-rose-600'
                                    }`}>"{d.pendingFeeUpdate.reason}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-black uppercase text-[9px] tracking-widest border ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-rose-100 text-rose-600 border-rose-200'
                            }`}>
                              {isApproved ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {d.pendingFeeUpdate?.status}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
             </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
