"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { LayoutDashboard, Users, UserCheck, CalendarDays, PieChart, Building2 } from "lucide-react";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: string;
  hospitalId: string;
  accessToken: string;
  isApprovedBySuperAdmin?: boolean;
};

// ... existing types ...

export default function HospitalAdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("patients"); // Default to patients since approvals are read-only
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) { router.push("/login"); return; }
    const s = JSON.parse(raw);
    if (s.role !== "hospital_admin") { router.push("/login"); return; }
    setSession(s);
  }, [router]);

  const authFetch = async (path: string, init?: RequestInit) => {
    if (!session?.accessToken) return;
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
    if (!session) return;
    if (session.isApprovedBySuperAdmin === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [docsData, patientsData, upcomingData, statsData] = await Promise.all([
        authFetch("/api/hospital-admin/doctors"),
        authFetch("/api/hospital-admin/patients"),
        authFetch("/api/hospital-admin/upcoming"),
        authFetch("/api/hospital-admin/stats"),
      ]);

      setDoctors(docsData || []);
      setPatients(patientsData || []);
      setUpcoming(upcomingData || []);
      setStats(statsData || null);
    } catch (e) {
      setError("Failed to sync data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  if (session && session.isApprovedBySuperAdmin === false) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white">
        <Card className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto">
             <Building2 className="text-amber-500 w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">Approval Pending</h1>
            <p className="text-slate-400 font-medium">Your hospital admin account is currently being reviewed by the Super Admin.</p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-sm text-slate-300 italic">
            "Once verified, you will gain full access to your hospital's management command center."
          </div>
          <Button variant="outline" className="w-full rounded-xl border-white/10 hover:bg-white/5 text-white font-bold py-6" onClick={() => router.push("/login")}>
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  const pendingDoctors = doctors.filter(d => 
    d.hospitalApprovals.some(a => String(a.hospitalId) === String(session?.hospitalId) && a.status === "pending")
  );
  
  const approvedDoctors = doctors.filter(d => 
    d.hospitalApprovals.some(a => String(a.hospitalId) === String(session?.hospitalId) && a.status !== "pending")
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans dark">
      {/* HEADER - Luxury Navigation */}
      <div className="w-full bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5 px-8 py-6 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 rounded-[20px] bg-[#1E3A8A]/20 flex items-center justify-center shadow-2xl border border-white/10 p-2 vip-border">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase">MediQueue</h1>
                <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase opacity-70">
                  Authorized Admin: <span className="text-[#D4AF37]">{session?.name}</span>
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Link href="/admin/charts">
                <Button variant="outline" className="rounded-[14px] font-bold gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all">
                   <PieChart className="w-4 h-4" /> Analytics
                </Button>
             </Link>
             <Link href="/profile">
                <Button className="rounded-[14px] font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] shadow-xl transition-all scale-95 hover:scale-100 gold-glow-hover">Command Profile</Button>
             </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR STATS - Luxury Glass Card */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="rounded-[20px] border border-white/5 shadow-2xl bg-[#0F172A]/60 backdrop-blur-md overflow-hidden">
              <CardHeader className="bg-white/5 pb-4 border-b border-white/5">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Command Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medical Staff</p>
                       <p className="text-3xl font-black text-white">{stats?.doctors || 0}</p>
                    </div>
                    <Users className="text-[#1E3A8A] w-8 h-8 opacity-40" />
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Patients</p>
                       <p className="text-3xl font-black text-white">{stats?.patients || 0}</p>
                    </div>
                    <UserCheck className="text-[#1E3A8A] w-8 h-8 opacity-40" />
                 </div>
                 <div className="pt-6 border-t border-white/5">
                    <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">Appointment Mix</p>
                    <div className="space-y-4">
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase">
                             <span className="text-emerald-400">Confirmed</span>
                             <span className="text-white">{stats?.appointments?.confirmed || 0}</span>
                          </div>
                          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                             <div className="bg-emerald-400 h-full" style={{ width: `${(stats?.appointments?.confirmed / (stats?.appointments?.total || 1)) * 100}%` }} />
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase">
                             <span className="text-amber-400">Pending</span>
                             <span className="text-white">{stats?.appointments?.pending || 0}</span>
                          </div>
                          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                             <div className="bg-amber-400 h-full" style={{ width: `${(stats?.appointments?.pending / (stats?.appointments?.total || 1)) * 100}%` }} />
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-3 space-y-8">
           {error && <div className="p-4 bg-rose-500/10 text-rose-400 rounded-[16px] border border-rose-500/20 font-black text-[10px] uppercase tracking-widest">{error}</div>}

           <Tabs defaultValue="patients" className="w-full">
              <TabsList className="bg-[#0F172A] p-1 rounded-[16px] border border-white/5 shadow-2xl mb-8 flex w-fit">
                 <TabsTrigger value="patients" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                    Patient Dossiers
                 </TabsTrigger>
                 <TabsTrigger value="upcoming" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                    Master Schedule
                 </TabsTrigger>
                 <TabsTrigger value="staff" className="rounded-[14px] font-black uppercase text-[10px] tracking-widest px-8 py-3 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white transition-all">
                    Medical Personnel
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="patients" className="space-y-4">
                 <div className="bg-white/5 rounded-3xl border border-white/5 shadow-2xl overflow-hidden backdrop-blur-sm">
                    <table className="w-full text-left">
                       <thead className="bg-white/5 border-b border-white/5">
                          <tr>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Patient Identity</th>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Specialist</th>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Encounter</th>
                             <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Operational Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          {patients.length === 0 ? (
                             <tr><td colSpan={4} className="p-16 text-center text-slate-500 font-bold italic opacity-50">No recorded patients for this location.</td></tr>
                          ) : (
                             patients.map(p => (
                                <tr key={p._id} className="hover:bg-white/5 transition-all cursor-pointer group">
                                   <td className="p-6">
                                      <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black shadow-inner border border-white/5 group-hover:scale-110 transition-transform">{p.name[0]}</div>
                                         <div>
                                            <p className="font-black text-white text-lg">{p.name}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{p.phone}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-6">
                                      <div className="flex items-center gap-2">
                                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                         <span className="font-bold text-slate-300 text-sm">Dr. {p.doctorName}</span>
                                      </div>
                                   </td>
                                   <td className="p-6">
                                      <span className="text-xs font-black text-slate-500 uppercase">{new Date(p.lastVisit).toLocaleDateString()}</span>
                                   </td>
                                   <td className="p-6 text-right">
                                      <Link href={`/admin/case/${p.appointmentId}`}>
                                         <Button variant="ghost" className="text-white font-black text-[10px] hover:bg-white hover:text-black rounded-xl px-6 border border-white/5 uppercase tracking-widest">Case File →</Button>
                                      </Link>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                 <div className="grid gap-6">
                    {upcoming.length === 0 ? (
                       <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 text-slate-500 font-bold">
                          No upcoming fixed appointments.
                       </div>
                    ) : (
                       upcoming.map(u => (
                          <Card key={u._id} className="rounded-3xl border border-white/5 shadow-2xl bg-white/5 hover:border-white/20 transition-all group backdrop-blur-sm">
                             <CardContent className="p-8 flex items-center justify-between">
                                <div className="flex items-center gap-8">
                                   <div className="flex flex-col items-center justify-center w-24 h-24 rounded-3xl bg-white text-black shadow-2xl scale-95 group-hover:scale-100 transition-transform">
                                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{new Date(u.date).toLocaleString('default', { month: 'short' })}</span>
                                      <span className="text-4xl font-black">{new Date(u.date).getDate()}</span>
                                   </div>
                                   <div className="space-y-2">
                                      <p className="font-black text-white text-2xl tracking-tighter uppercase">{u.patientId.name}</p>
                                      <div className="flex items-center gap-3 mt-1">
                                         <Badge className="bg-white/10 text-white border-white/10 font-black text-[10px] uppercase tracking-widest py-1 px-3">Fixed Appt</Badge>
                                         <span className="text-xs font-bold text-slate-500 italic opacity-80">Under Dr. {u.doctorId.name}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className="text-3xl font-black text-white tracking-tighter">{new Date(u.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                   <p className="text-[10px] font-black text-slate-500 uppercase mt-1 tracking-widest opacity-60">Scheduled Time</p>
                                </div>
                             </CardContent>
                          </Card>
                       ))
                    )}
                 </div>
              </TabsContent>

              <TabsContent value="staff" className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {doctors.map(d => (
                       <Card key={d._id} className="rounded-3xl border border-white/5 shadow-2xl bg-white/5 p-6 hover:bg-white/10 transition-all backdrop-blur-sm border-l-4 border-l-emerald-500">
                          <CardContent className="p-0 flex items-center gap-6">
                             <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-black text-white text-xl uppercase">
                                {d.name[0]}
                             </div>
                             <div className="flex-1 space-y-1">
                                <p className="font-black text-white text-lg tracking-tight uppercase">Dr. {d.name}</p>
                                <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{d.specialization}</p>
                                <div className="flex items-center gap-2 mt-2">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                   <span className="text-[10px] font-black text-emerald-400 uppercase">Verified Staff</span>
                                </div>
                             </div>
                          </CardContent>
                       </Card>
                    ))}
                 </div>
              </TabsContent>
           </Tabs>
        </div>
      </div>
    </div>
  );
}
