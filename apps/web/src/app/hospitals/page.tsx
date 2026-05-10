"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Hospital = {
  _id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone?: string;
  subscriptionTier: string;
  isActive: boolean;
};

type Doctor = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization?: string;
  hospitalId?: Hospital;
};

function getSession() {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    premium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${map[tier] || map.free}`}>
      {tier}
    </span>
  );
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"hospitals" | "doctors">("hospitals");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const session = getSession();
    const headers: Record<string, string> = {};
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    
    
    setLoading(true);
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005'}/api/hospitals`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005'}/api/users/doctors`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).then((r) => r.json())
    ])
    .then(([hospitalsData, doctorsData]) => {
      if (Array.isArray(hospitalsData)) setHospitals(hospitalsData);
      else setError(hospitalsData?.message || "Failed to load hospitals");

      if (Array.isArray(doctorsData)) setDoctors(doctorsData);
    })
    .catch(() => setError("Server error"))
    .finally(() => setLoading(false));
  }, []);

  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    h.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.specialization || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.hospitalId?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="w-full bg-gradient-to-br from-emerald-500/10 via-primary/5 to-background border-b border-muted px-8 py-10">
        <div className="max-w-5xl mx-auto">
          <Link href="/patient" className="text-sm text-primary hover:underline mb-4 inline-block">← Back to Dashboard</Link>
          <h1 className="text-4xl font-bold tracking-tight">Facility & Specialist Search</h1>
          <p className="text-muted-foreground mt-1">Find and book appointments at hospitals or search for specific doctors.</p>
          
          <div className="mt-6 max-w-md">
            <Input 
              type="text" 
              placeholder={activeTab === "hospitals" ? "Search hospitals by name or location..." : "Search doctors by name or specialization..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border-muted bg-background shadow-sm"
            />
          </div>
          
          <div className="mt-6 flex gap-4 border-b border-muted/30 pb-2">
            <button 
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "hospitals" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("hospitals")}
            >
              Hospitals ({filteredHospitals.length})
            </button>
            <button 
              className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === "doctors" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab("doctors")}
            >
              Specialists ({filteredDoctors.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">{error}</div>
        )}

        {/* Hospitals View */}
        {!loading && activeTab === "hospitals" && (
          <>
            {filteredHospitals.length === 0 && !error && (
              <div className="text-center py-16 text-muted-foreground italic">No hospitals found matching "{searchQuery}".</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredHospitals.map((h) => (
                <Card key={h._id} className="rounded-2xl border-muted shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-200 group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                        🏥
                      </div>
                      <TierBadge tier={h.subscriptionTier} />
                    </div>
                    <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">
                      <Link href={`/hospitals/detail?id=${h._id}`}>{h.name}</Link>
                    </CardTitle>
                    <CardDescription className="text-xs">{h.address}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>✉️</span>
                      <a href={`mailto:${h.contactEmail}`} className="hover:text-primary transition-colors truncate">{h.contactEmail}</a>
                    </div>
                    {h.contactPhone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>📞</span>
                        <a href={`tel:${h.contactPhone}`} className="hover:text-primary transition-colors">{h.contactPhone}</a>
                      </div>
                    )}
                    <div className="pt-2">
                      <Link href={`/hospitals/detail?id=${h._id}`}>
                        <Button size="sm" className="w-full rounded-xl">View Facility</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Doctors View */}
        {!loading && activeTab === "doctors" && (
          <>
            {filteredDoctors.length === 0 && !error && (
              <div className="text-center py-16 text-muted-foreground italic">No specialists found matching "{searchQuery}".</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDoctors.map((d) => (
                <Card key={d._id} className="rounded-2xl border-muted shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-200 group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-black text-white shrink-0">
                        {d.name.charAt(0)}
                      </div>
                      {d.specialization && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20 bg-primary/10 px-2 py-0.5 rounded-full">
                          {d.specialization}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">
                      <Link href={`/doctors?id=${d._id}`}>Dr. {d.name}</Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {d.hospitalId?.name || "Independent"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="pt-2">
                      <Link href={`/doctors?id=${d._id}`}>
                        <Button size="sm" className="w-full rounded-xl bg-white text-black hover:bg-slate-200">View Profile</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
