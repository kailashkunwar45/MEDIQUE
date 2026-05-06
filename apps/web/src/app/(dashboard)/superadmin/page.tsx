"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";
import { Building2, Users, DollarSign, TrendingUp, Crown, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Mock Platform Data ---
const kpis = [
  { label: "Total Hospitals", value: "48", change: "+3 this month", icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Total Users", value: "12,840", change: "+840 this month", icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
  { label: "Platform Revenue", value: "NPR 2.4M", change: "+22% MoM", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Active Queues", value: "127", change: "Live right now", icon: Activity, color: "text-rose-400", bg: "bg-rose-500/10" },
];

const revenueByMonth = [
  { month: "Nov", revenue: 180000 },
  { month: "Dec", revenue: 220000 },
  { month: "Jan", revenue: 310000 },
  { month: "Feb", revenue: 280000 },
  { month: "Mar", revenue: 390000 },
  { month: "Apr", revenue: 440000 },
];

const subscriptionBreakdown = [
  { name: "Free", value: 28, color: "#6b7280" },
  { name: "Pro", value: 14, color: "#6366f1" },
  { name: "Premium", value: 6, color: "#f59e0b" },
];

const topHospitals = [
  { name: "Kathmandu General", appointments: 1248, tier: "Premium", revenue: "NPR 6.2L" },
  { name: "Patan Hospital", appointments: 980, tier: "Pro", revenue: "NPR 4.9L" },
  { name: "BPKIHS Dharan", appointments: 870, tier: "Premium", revenue: "NPR 4.4L" },
  { name: "Om Hospital", appointments: 720, tier: "Pro", revenue: "NPR 3.6L" },
  { name: "Grande Hospital", appointments: 640, tier: "Premium", revenue: "NPR 3.2L" },
];

const tierBadge: Record<string, string> = {
  Premium: "bg-amber-500/10 text-amber-400",
  Pro: "bg-indigo-500/10 text-indigo-400",
  Free: "bg-muted text-muted-foreground",
};

const tierIcon: Record<string, JSX.Element> = {
  Premium: <Crown className="w-3 h-3 inline mr-1" />,
  Pro: <Zap className="w-3 h-3 inline mr-1" />,
  Free: <span />,
};

export default function SuperAdminDashboard() {
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

  const loadRealPlatformAnalytics = async () => {
    setApiError("");
    setApiResult(null);
    try {
      if (!accessToken) throw new Error("Not logged in");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/platform`, {
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
          <h1 className="text-3xl font-bold tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground mt-1">MediQueue Platform · Global Overview</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Platform Health · Healthy
        </div>
      </div>

      <Card className="rounded-2xl border-muted shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Real Platform Analytics (API)</CardTitle>
          <CardDescription>Calls `GET /api/analytics/platform` using your login token</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loadRealPlatformAnalytics} className="rounded-xl">
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

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border-muted shadow-lg hover:shadow-primary/5 transition-shadow">
            <CardContent className="pt-5 pb-5 px-5">
              <div className={`inline-flex p-2.5 rounded-xl mb-3 ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{kpi.label}</div>
              <div className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />{kpi.change}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2 rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform Revenue</CardTitle>
            <CardDescription>Monthly subscription + transaction revenue (NPR)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: '#1c1c2e', border: '1px solid #2d2d3d', borderRadius: '12px' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`NPR ${Number(v).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Breakdown */}
        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscriptions</CardTitle>
            <CardDescription>Distribution across tiers</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={subscriptionBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {subscriptionBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1c1c2e', border: '1px solid #2d2d3d', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              {subscriptionBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                  {s.name} ({s.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Hospitals Table */}
      <Card className="rounded-2xl border-muted shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Performing Hospitals</CardTitle>
          <CardDescription>Ranked by total appointments this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-muted">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Hospital</th>
                  <th className="text-left py-2 font-medium">Appointments</th>
                  <th className="text-left py-2 font-medium">Plan</th>
                  <th className="text-left py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {topHospitals.map((h, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 text-muted-foreground font-mono">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 font-semibold">{h.name}</td>
                    <td className="py-3 text-muted-foreground">{h.appointments.toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${tierBadge[h.tier]}`}>
                        {tierIcon[h.tier]}{h.tier}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-emerald-400">{h.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
