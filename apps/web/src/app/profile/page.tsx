"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: string;
  hospitalId?: string;
  accessToken: string;
  refreshToken?: string;
};

type ProfileData = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  specialization?: string;
  bio?: string;
};

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    patient: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    doctor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    hospital_admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    super_admin: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  const labels: Record<string, string> = {
    patient: "Patient",
    doctor: "Doctor",
    hospital_admin: "Hospital Admin",
    super_admin: "Super Admin",
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${map[role] || "bg-muted text-muted-foreground border-muted"}`}>
      {labels[role] || role}
    </span>
  );
}

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

function getBackHref(role: string): string {
  const map: Record<string, string> = { patient: "/patient", doctor: "/doctor", hospital_admin: "/admin", super_admin: "/superadmin" };
  return map[role] || "/";
}

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [degree, setDegree] = useState("");
  const [college, setCollege] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [previousWork, setPreviousWork] = useState("");
  // Hospital fields
  const [certification, setCertification] = useState("");
  const [services, setServices] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const s = getSession();
    setSession(s);
  }, []);

  const authFetch = async (path: string, init?: RequestInit) => {
    if (!session?.accessToken) throw new Error("Not logged in");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
    return json;
  };

  const load = async () => {
    setError(""); setInfo("");
    try {
      const me = await authFetch("/api/users/me");
      setProfile(me);
      setName(me?.name || "");
      setPhone(me?.phone || "");
      setSpecialization(me?.specialization || "");
      setDegree(me?.degree || "");
      setCertification(me?.certification || "");
      setCollege(me?.college || "");
      setExperienceYears(me?.experienceYears?.toString() || "");
      setPreviousWork(me?.previousWork || "");
      
      if (me.role === 'hospital_admin' && me.hospitalId) {
        const hData = await authFetch(`/api/hospitals/${me.hospitalId}`);
        setCertification(hData.hospital.certification || "");
        setServices(hData.hospital.services?.join(", ") || "");
      }
    } catch (e: any) { setError(e?.message || "Failed to load profile"); }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    void load();
  }, [session?.accessToken]);

  const save = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      const updated = await authFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ 
          name, 
          phone, 
          specialization, 
          degree, 
          certification: session?.role === 'doctor' ? certification : undefined, 
          college, 
          experienceYears: Number(experienceYears), 
          previousWork 
        }),
      });

      if (session?.role === 'hospital_admin') {
         await authFetch("/api/hospital-admin/onboard", {
            method: "POST",
            body: JSON.stringify({
               certification,
               services: services.split(",").map(s => s.trim()).filter(s => s)
            })
         });
      }

      setInfo("Profile updated successfully.");
      const nextSession = session ? { ...session, name: updated?.name || name } : session;
      if (nextSession) {
        localStorage.setItem("mediqueue_session", JSON.stringify(nextSession));
        setSession(nextSession);
      }
    } catch (e: any) { setError(e?.message || "Failed to save"); }
    finally { setLoading(false); }
  };

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const role = session?.role || profile?.role || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="w-full bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b border-muted px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href={getBackHref(role)} className="text-sm text-primary hover:underline mb-4 inline-block">← Back to Dashboard</Link>
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-xl shadow-primary/20 shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{name || "My Profile"}</h1>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={role} />
                {session?.email && <span className="text-sm text-muted-foreground">{session.email}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-4">
        {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</div>}
        {info && <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">{info}</div>}

        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Account Info</CardTitle>
            <CardDescription>Update your personal information below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+977-..." className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email <span className="text-muted-foreground text-xs">(read only)</span></Label>
              <Input value={session?.email || ""} readOnly className="rounded-xl opacity-60 cursor-not-allowed" />
            </div>

            {role === "hospital_admin" && (
              <>
                <div className="space-y-1">
                  <Label>Hospital Certification / License No.</Label>
                  <Input value={certification} onChange={(e) => setCertification(e.target.value)} placeholder="LIC-123456" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label>Services Provided (Comma separated)</Label>
                  <textarea
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="Cardiology, Emergency, etc."
                    rows={4}
                    className="w-full rounded-xl bg-muted/30 border border-muted px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}

            {/* Doctor-specific fields */}
            {role === "doctor" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                   <div className="space-y-1">
                     <Label>Specialization</Label>
                     <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Cardiology, etc." className="rounded-xl" />
                   </div>
                   <div className="space-y-1">
                     <Label>Degree</Label>
                     <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="MBBS, etc." className="rounded-xl" />
                   </div>
                   <div className="space-y-1">
                     <Label>Certification</Label>
                     <Input value={certification} onChange={(e) => setCertification(e.target.value)} placeholder="Board Certified, etc." className="rounded-xl" />
                   </div>
                   <div className="space-y-1">
                     <Label>College/Institution</Label>
                     <Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="Harvard, etc." className="rounded-xl" />
                   </div>
                   <div className="space-y-1">
                     <Label>Years of Experience</Label>
                     <Input type="number" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className="rounded-xl" />
                   </div>
                </div>
                <div className="space-y-1">
                  <Label>Previous Working Experience</Label>
                  <textarea
                    value={previousWork}
                    onChange={(e) => setPreviousWork(e.target.value)}
                    placeholder="Where have you worked before?"
                    rows={4}
                    className="w-full rounded-xl bg-muted/30 border border-muted px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}

            <Button onClick={save} className="rounded-xl w-full" disabled={loading || !session?.accessToken}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick links for doctor */}
        {role === "doctor" && (
          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">My Public Profile</CardTitle>
              <CardDescription>This is what patients see when they click on your name.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/doctors/${session?._id}`}>
                <Button variant="outline" className="rounded-xl w-full">View Public Profile</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick links for patient */}
        {role === "patient" && (
          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href="/patient">
                <Button variant="outline" className="rounded-xl w-full text-sm">My Appointments</Button>
              </Link>
              <Link href="/hospitals">
                <Button variant="outline" className="rounded-xl w-full text-sm">Browse Hospitals</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
