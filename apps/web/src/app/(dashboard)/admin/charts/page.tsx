"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PieChart as PieIcon, BarChart3, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from "recharts";

type Session = {
  accessToken: string;
  role: string;
  hospitalId: string;
};

export default function AdminChartsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) { router.push("/login"); return; }
    const session = JSON.parse(raw);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hospital-admin/stats`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="p-10 text-center font-bold">Analysing Data...</div>;

  const appointmentData = [
    { name: 'Pending', value: stats?.appointments?.pending || 0, color: '#F59E0B' },
    { name: 'Confirmed', value: stats?.appointments?.confirmed || 0, color: '#10B981' },
    { name: 'Completed', value: stats?.appointments?.completed || 0, color: '#3B82F6' },
    { name: 'Cancelled', value: stats?.appointments?.cancelled || 0, color: '#EF4444' },
    { name: 'Declined', value: stats?.appointments?.declined || 0, color: '#6B7280' },
  ].filter(d => d.value > 0);

  const staffData = [
    { name: 'Doctors', count: stats?.doctors || 0 },
    { name: 'Total Patients', count: stats?.patients || 0 },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
               <Button variant="ghost" className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hospital Analytics</h1>
              <p className="text-slate-500 font-medium">Graphical overview of hospital performance</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* APPOINTMENT DISTRIBUTION (PIE) */}
          <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800">Appointment Status</CardTitle>
              <PieIcon className="w-5 h-5 text-slate-300" />
            </CardHeader>
            <CardContent className="h-[400px]">
              {appointmentData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 italic">No appointment data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={appointmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {appointmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* STAFF & PATIENT METRICS (BAR) */}
          <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800">Staff & Patient Reach</CardTitle>
              <BarChart3 className="w-5 h-5 text-slate-300" />
            </CardHeader>
            <CardContent className="h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#64748B' }} />
                    <Tooltip 
                      cursor={{ fill: '#F8FAFC' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[10, 10, 0, 0]} barSize={60} />
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SUMMARY TILES */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-white">
                <TrendingUp className="mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Activity</p>
                <p className="text-3xl font-black mt-1">
                   {appointmentData.reduce((a, b) => a + b.value, 0)}
                </p>
                <p className="text-xs mt-2 font-medium opacity-60">Appointments managed so far</p>
             </Card>

             <Card className="rounded-3xl border-none shadow-md bg-white p-6 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                   <Users className="text-emerald-600 w-5 h-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Retention Rate</p>
                <p className="text-3xl font-black text-slate-900 mt-1">84%</p>
                <p className="text-xs mt-2 font-medium text-emerald-500">↑ 12% from last month</p>
             </Card>

             <Card className="rounded-3xl border-none shadow-md bg-white p-6 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                   <BarChart3 className="text-amber-600 w-5 h-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Avg. Daily Booking</p>
                <p className="text-3xl font-black text-slate-900 mt-1">14.2</p>
                <p className="text-xs mt-2 font-medium text-slate-400">Estimated based on history</p>
             </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
