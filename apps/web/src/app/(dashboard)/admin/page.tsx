"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Legend
} from "recharts";
import { Users, Calendar, DollarSign, Activity, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Mock Data ---
const kpis = [
  { label: "Total Appointments", value: "1,248", change: "+12%", icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Total Revenue", value: "NPR 6,24,000", change: "+8.5%", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Active Doctors", value: "12", change: "+2", icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
  { label: "Avg Wait Time", value: "18 min", change: "-3 min", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  { label: "Completion Rate", value: "89%", change: "+4%", icon: CheckCircle2, color: "text-teal-400", bg: "bg-teal-500/10" },
  { label: "Queue Throughput", value: "42/day", change: "+6%", icon: Activity, color: "text-rose-400", bg: "bg-rose-500/10" },
];

const appointmentTrend = [
  { date: "Mon", appointments: 38, revenue: 19000 },
  { date: "Tue", appointments: 52, revenue: 26000 },
  { date: "Wed", appointments: 45, revenue: 22500 },
  { date: "Thu", appointments: 61, revenue: 30500 },
  { date: "Fri", appointments: 70, revenue: 35000 },
  { date: "Sat", appointments: 48, revenue: 24000 },
  { date: "Sun", appointments: 22, revenue: 11000 },
];

const recentPayments = [
  { patient: "Aarav Sharma", amount: "NPR 500", method: "Khalti", status: "success", time: "2 min ago" },
  { patient: "Priya Gurung", amount: "NPR 500", method: "eSewa", status: "success", time: "15 min ago" },
  { patient: "Bikash Rai", amount: "NPR 500", method: "Khalti", status: "success", time: "32 min ago" },
  { patient: "Sita Thapa", amount: "NPR 500", method: "eSewa", status: "pending", time: "1 hr ago" },
  { patient: "Rohan Khadka", amount: "NPR 500", method: "Khalti", status: "failed", time: "2 hr ago" },
];

const statusColor: Record<string, string> = {
  success: "text-emerald-400 bg-emerald-500/10",
  pending: "text-amber-400 bg-amber-500/10",
  failed: "text-rose-400 bg-rose-500/10",
};

export default function HospitalAdminDashboard() {
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { accessToken?: string };
      if (s.accessToken) setAccessToken(s.accessToken);
    } catch {
      // ignore
    }
  }, []);

  const loadRealHospitalAnalytics = async () => {
    setApiError("");
    setApiResult(null);
    try {
      if (!accessToken) throw new Error("Not logged in");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/hospital`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
      setApiResult(json);
    } catch (e: any) {
      setApiError(e?.message || "Failed to load analytics");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hospital Admin</h1>
          <p className="text-muted-foreground mt-1">Kathmandu General Hospital · Dashboard Overview</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live · Updated just now
        </div>
      </div>

      <Card className="rounded-2xl border-muted shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Real Hospital Analytics (API)</CardTitle>
          <CardDescription>Calls `GET /api/analytics/hospital` using your login token</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loadRealHospitalAnalytics} className="rounded-xl">
            Load Real Analytics
          </Button>
          {apiError && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {apiError}
            </div>
          )}
          {apiResult && (
            <pre className="text-xs bg-muted/30 border border-muted rounded-xl p-3 overflow-auto max-h-72">
              {JSON.stringify(apiResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border-muted shadow-lg hover:shadow-primary/5 transition-shadow">
            <CardContent className="pt-4 pb-4 px-4">
              <div className={`inline-flex p-2 rounded-xl mb-3 ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-xl font-bold truncate">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
              <div className="text-xs text-emerald-400 mt-1 font-medium">{kpi.change}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Appointment & Revenue Trend */}
        <Card className="lg:col-span-3 rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Overview</CardTitle>
            <CardDescription>Appointments & Revenue — this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={appointmentTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aptColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1c1c2e', border: '1px solid #2d2d3d', borderRadius: '12px' }}
                  labelStyle={{ color: '#a0a0b0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="appointments" stroke="#6366f1" fill="url(#aptColor)" strokeWidth={2} dot={false} name="Appointments" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revColor)" strokeWidth={2} dot={false} name="Revenue (NPR)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointment Status Breakdown */}
        <Card className="lg:col-span-2 rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Appointment Status</CardTitle>
            <CardDescription>Breakdown by status today</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { status: "Completed", count: 42, fill: "#10b981" },
                { status: "Pending", count: 18, fill: "#f59e0b" },
                { status: "Cancelled", count: 5, fill: "#ef4444" },
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1c1c2e', border: '1px solid #2d2d3d', borderRadius: '12px' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <CardDescription>Latest 5 payment activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-muted">
                    <th className="text-left py-2 font-medium">Patient</th>
                    <th className="text-left py-2 font-medium">Amount</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {recentPayments.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium">{p.patient}</td>
                      <td className="py-3 text-muted-foreground">{p.amount}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${statusColor[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <CardDescription>Scheduled for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-muted">
                    <th className="text-left py-2 font-medium">Token</th>
                    <th className="text-left py-2 font-medium">Patient</th>
                    <th className="text-left py-2 font-medium">Doctor</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {[
                    { token: "001", patient: "Aarav Sharma", doctor: "Dr. Smith", status: "Completed" },
                    { token: "002", patient: "Priya Gurung", doctor: "Dr. Smith", status: "Serving" },
                    { token: "003", patient: "Bikash Rai", doctor: "Dr. Smith", status: "Waiting" },
                    { token: "004", patient: "Sita Thapa", doctor: "Dr. Adams", status: "Waiting" },
                    { token: "005", patient: "Rohan Khadka", doctor: "Dr. Adams", status: "Waiting" },
                  ].map((a, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-mono font-bold text-primary">{a.token}</td>
                      <td className="py-3 font-medium">{a.patient}</td>
                      <td className="py-3 text-muted-foreground">{a.doctor}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          a.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                          a.status === 'Serving' ? 'bg-blue-500/10 text-blue-400 animate-pulse' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
