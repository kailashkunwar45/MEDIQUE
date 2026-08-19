import { useEffect, useState } from "react";
import { useRouter } from "@/hooks/useRouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, TrendingUp, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
export default function DoctorChartsPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    useEffect(() => {
        const raw = localStorage.getItem("mediqueue_session");
        if (!raw) {
            router.push("/login");
            return;
        }
        const session = JSON.parse(raw);
        fetch(`/api/hospital-admin/doctor/stats`, {
            headers: { Authorization: `Bearer ${session.accessToken}` }
        })
            .then(res => res.json())
            .then(data => {
            setStats(data);
            setLoading(false);
        })
            .catch(() => setLoading(false));
    }, [router]);
    if (loading)
        return <div className="p-10 text-center font-bold">Loading Stats...</div>;
    const appointmentData = [
        { name: 'Pending', value: stats?.appointments?.pending || 0, color: '#F59E0B' },
        { name: 'Confirmed', value: stats?.appointments?.confirmed || 0, color: '#10B981' },
        { name: 'Completed', value: stats?.appointments?.completed || 0, color: '#3B82F6' },
        { name: 'Cancelled', value: stats?.appointments?.cancelled || 0, color: '#EF4444' },
        { name: 'Declined', value: stats?.appointments?.declined || 0, color: '#6B7280' },
    ].filter(d => d.value > 0);
    const ratingData = [
        { name: '1 Star', count: stats?.ratings?.['1'] || 0 },
        { name: '2 Stars', count: stats?.ratings?.['2'] || 0 },
        { name: '3 Stars', count: stats?.ratings?.['3'] || 0 },
        { name: '4 Stars', count: stats?.ratings?.['4'] || 0 },
        { name: '5 Stars', count: stats?.ratings?.['5'] || 0 },
    ];
    return (<div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/doctor">
               <Button variant="ghost" className="rounded-xl"><ArrowLeft className="w-5 h-5"/></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Performance Stats</h1>
              <p className="text-slate-500 font-medium">Insights into your medical practice</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* APPOINTMENT MIX */}
          <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-800">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {appointmentData.length === 0 ? (<div className="h-full flex items-center justify-center text-slate-400 italic">No activity recorded yet.</div>) : (<ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={appointmentData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {appointmentData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none"/>))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}/>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>)}
            </CardContent>
          </Card>

          {/* RATINGS DISTRIBUTION */}
          <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800">Patient Satisfaction</CardTitle>
              <Star className="w-5 h-5 text-amber-400 fill-amber-400"/>
            </CardHeader>
            <CardContent className="h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9"/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#64748B' }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fill: '#64748B' }}/>
                    <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}/>
                    <Bar dataKey="count" fill="#F59E0B" radius={[10, 10, 0, 0]} barSize={40}/>
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SUMMARY TILES */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
                <TrendingUp className="mb-4 opacity-50"/>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Completion Rate</p>
                <p className="text-3xl font-black mt-1">
                   {stats?.appointments?.completed || 0} Cases
                </p>
                <p className="text-xs mt-2 font-medium opacity-60">Successfully managed patients</p>
             </Card>

             <Card className="rounded-3xl border-none shadow-md bg-white p-6 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                   <Calendar className="text-primary w-5 h-5"/>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next Scheduled</p>
                <p className="text-2xl font-black text-slate-900 mt-1">Tomorrow, 10:00 AM</p>
                <p className="text-xs mt-2 font-medium text-primary">View in dashboard →</p>
             </Card>

             <Card className="rounded-3xl border-none shadow-md bg-white p-6 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mb-4">
                   <TrendingUp className="text-rose-600 w-5 h-5 rotate-180"/>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cancel Rate</p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                   {((stats?.appointments?.cancelled || 0) / (stats?.appointments?.total || 1) * 100).toFixed(1)}%
                </p>
                <p className="text-xs mt-2 font-medium text-rose-500">Industry avg: 14%</p>
             </Card>
          </div>
        </div>
      </div>
    </div>);
}
