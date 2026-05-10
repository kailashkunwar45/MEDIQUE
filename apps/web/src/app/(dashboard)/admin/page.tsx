"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  CalendarDays, 
  PieChart as ChartIcon, 
  Building2,
  Activity,
  ShieldCheck,
  TrendingUp,
  Clock
} from "lucide-react";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: string;
  hospitalId: string;
  accessToken: string;
  isApprovedBySuperAdmin?: boolean;
};

type Doctor = {
  _id: string;
  name: string;
  specialization: string;
  hospitalApprovals: { hospitalId: string; status: string }[];
};

type Patient = {
  _id: string;
  name: string;
  phone: string;
  doctorName: string;
  lastVisit: string;
  appointmentId: string;
};

type UpcomingAppt = {
  _id: string;
  patientId: { name: string };
  doctorId: { name: string };
  date: string;
};

export default function HospitalAdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("mediqueue_session");
    window.location.href = "/login";
  };

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) { router.push("/login"); return; }
    const s = JSON.parse(raw);
    if (s.role !== "hospital_admin") { router.push("/login"); return; }
    setSession(s);
  }, [router]);

  const authFetch = async (path: string, init?: RequestInit) => {
    if (!session?.accessToken) return;
    const res = await fetch(`${path}`, {
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
      setUpcoming(upcomingData || []);
      setStats(statsData || null);
    } catch (e) {
      setError("Failed to sync hospital data");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (session) loadData();
  }, [session]);

  if (session && session.isApprovedBySuperAdmin === false) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-900">
        <Card className="max-w-md w-full rounded-[32px] border-none shadow-[0_20px_60px_rgba(15,23,42,0.1)] bg-white p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-amber-50 border border-amber-100 rounded-[24px] flex items-center justify-center mx-auto shadow-inner">
             <Building2 className="text-amber-500 w-12 h-12" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-[#0F172A] uppercase">Facility Approval</h1>
            <p className="text-slate-500 font-bold leading-relaxed">Your hospital administrative account is currently under verification by the global medical board.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-[20px] border border-slate-100 text-[10px] font-black uppercase tracking-widest text-[#1E3A8A] italic">
            "Once authorized, you will gain full command of your facility's operational network."
          </div>
          <Button variant="outline" className="w-full rounded-[16px] border-slate-200 hover:bg-slate-50 text-slate-900 font-black py-8 uppercase tracking-widest text-[10px]" onClick={() => { localStorage.removeItem("mediqueue_session"); window.location.href="/login"; }}>
            Secure Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <Navbar session={session} />

      <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* SIDEBAR ANALYTICS */}
        <div className="lg:col-span-1 space-y-8">
           <Card className="rounded-[24px] border border-slate-200 shadow-[0_10px_40px_rgba(15,23,42,0.05)] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest text-[#1E3A8A]">Hospital Insights</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="flex items-center justify-between group">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Staff</p>
                       <p className="text-4xl font-black text-[#0F172A] tracking-tighter">{stats?.doctors || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-[16px] bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Users className="text-indigo-500 w-6 h-6" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between group">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Patients</p>
                       <p className="text-4xl font-black text-[#0F172A] tracking-tighter">{stats?.patients || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-[16px] bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <UserCheck className="text-emerald-500 w-6 h-6" />
                    </div>
                 </div>
                 <div className="pt-8 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Appointment Status</p>
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                             <span className="text-emerald-600">Confirmed</span>
                             <span className="text-[#0F172A]">{stats?.appointments?.confirmed || 0}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                             <div className="bg-emerald-500 h-full" style={{ width: `${(stats?.appointments?.confirmed / (stats?.appointments?.total || 1)) * 100}%` }} />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                             <span className="text-amber-600">Awaiting Auth</span>
                             <span className="text-[#0F172A]">{stats?.appointments?.pending || 0}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                             <div className="bg-amber-500 h-full" style={{ width: `${(stats?.appointments?.pending / (stats?.appointments?.total || 1)) * 100}%` }} />
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-[#1E3A8A]/5 rounded-[24px] border border-[#1E3A8A]/10 space-y-4">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1E3A8A]">Security Protocol</h4>
              </div>
              <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">Full administrative override active. All medical staff and patient data encrypted under ISO-27001 standards.</p>
           </div>
        </div>

        {/* MAIN OPERATIONAL TERMINAL */}
        <div className="lg:col-span-3 space-y-10">
           {error && <div className="p-6 bg-rose-50 text-rose-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest border border-rose-100 shadow-sm animate-pulse">{error}</div>}

           <Tabs defaultValue="patients" className="w-full space-y-8">
              <TabsList className="bg-white p-1 rounded-[16px] border border-slate-200 shadow-xl flex w-fit">
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
                 <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_15px_50px_rgba(15,23,42,0.05)] overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                             <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Identity</th>
                             <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Specialist</th>
                             <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Encounter</th>
                             <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Operational Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {patients.length === 0 ? (
                             <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] italic">No active patient files recorded.</td></tr>
                          ) : (
                             patients.map(p => (
                                <tr key={p._id} className="hover:bg-slate-50/50 transition-all cursor-pointer group">
                                   <td className="p-8">
                                      <div className="flex items-center gap-5">
                                         <div className="w-14 h-14 rounded-[18px] bg-slate-50 flex items-center justify-center text-[#0F172A] font-black shadow-inner border border-slate-100 group-hover:scale-110 group-hover:bg-[#1E3A8A] group-hover:text-white transition-all duration-300">{p.name[0]}</div>
                                         <div>
                                            <p className="font-black text-[#0F172A] text-lg tracking-tighter uppercase">{p.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.phone}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-8">
                                      <div className="flex items-center gap-3">
                                         <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                                         <span className="font-black text-slate-600 text-[11px] uppercase tracking-tight">Dr. {p.doctorName}</span>
                                      </div>
                                   </td>
                                   <td className="p-8">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.lastVisit).toLocaleDateString()}</span>
                                   </td>
                                   <td className="p-8 text-right">
                                      <Link href={`/admin/case/detail?id=${p.appointmentId}`}>
                                         <Button variant="outline" className="text-[#1E3A8A] font-black text-[10px] hover:bg-[#1E3A8A] hover:text-white rounded-[14px] px-8 h-12 border-slate-200 uppercase tracking-widest shadow-sm transition-all">Open File →</Button>
                                      </Link>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-6">
                 <div className="grid gap-6">
                    {upcoming.length === 0 ? (
                       <div className="text-center py-32 bg-white rounded-[32px] border border-dashed border-slate-200 shadow-sm">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock className="text-slate-200 w-10 h-10" />
                          </div>
                          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Master Schedule Clear.</p>
                       </div>
                    ) : (
                       upcoming.map(u => (
                          <Card key={u._id} className="rounded-[24px] border-none shadow-[0_15px_40px_rgba(15,23,42,0.06)] bg-white hover:scale-[1.01] transition-all group overflow-hidden">
                             <CardContent className="p-10 flex flex-col sm:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-10">
                                   <div className="flex flex-col items-center justify-center w-28 h-28 rounded-[24px] bg-[#1E3A8A] text-white shadow-2xl scale-95 group-hover:scale-100 transition-transform duration-500">
                                      <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{new Date(u.date).toLocaleString('default', { month: 'short' })}</span>
                                      <span className="text-5xl font-black tracking-tighter">{new Date(u.date).getDate()}</span>
                                   </div>
                                   <div className="space-y-3">
                                      <p className="font-black text-[#0F172A] text-3xl tracking-tighter uppercase">{u.patientId.name}</p>
                                      <div className="flex items-center gap-3">
                                         <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[9px] uppercase tracking-widest py-1.5 px-4 rounded-full">Authorized Encounter</Badge>
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specialist: Dr. {u.doctorId.name}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right border-l border-slate-100 pl-10">
                                   <p className="text-4xl font-black text-[#1E3A8A] tracking-tighter">{new Date(u.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                   <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Scheduled Window</p>
                                </div>
                             </CardContent>
                          </Card>
                       ))
                    )}
                 </div>
              </TabsContent>

              <TabsContent value="staff" className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {doctors.map(d => (
                       <Card key={d._id} className="rounded-[24px] border-none shadow-[0_15px_40px_rgba(15,23,42,0.06)] bg-white p-8 hover:bg-slate-50 transition-all group border-l-4 border-l-[#1E3A8A]">
                          <CardContent className="p-0 flex items-center gap-6">
                             <div className="w-16 h-16 rounded-[20px] bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-[#1E3A8A] text-2xl uppercase shadow-inner group-hover:scale-110 transition-transform">
                                {d.name[0]}
                             </div>
                             <div className="flex-1 space-y-1">
                                <p className="font-black text-[#0F172A] text-xl tracking-tighter uppercase">Dr. {d.name}</p>
                                <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase">{d.specialization}</p>
                                <div className="flex items-center gap-2 mt-3">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                   <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active Staff</span>
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
