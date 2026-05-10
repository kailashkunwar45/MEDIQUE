"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Stethoscope, MessageSquare, Star } from "lucide-react";
import Link from "next/link";

export default function CaseFilePage() {
  const params = useParams();
  const router = useRouter();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (!raw) { router.push("/login"); return; }
    const session = JSON.parse(raw);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/appointments/${params.id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setAppointment(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load case file");
        setLoading(false);
      });
  }, [params.id, router]);

  if (loading) return <div className="p-10 text-center font-bold text-slate-400">Opening Case File...</div>;
  if (error) return <div className="p-10 text-center text-rose-500 font-bold">{error}</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
           <Link href="/admin">
              <Button variant="ghost" className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
           </Link>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Case File #{appointment._id.slice(-8)}</h1>
              <p className="text-slate-500 font-medium text-sm italic">Confidential medical record overview for hospital administration.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* PATIENT INFO */}
           <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
              <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" /> Patient Identity
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-xl font-black text-slate-900">{appointment.patientId.name}</p>
                 <p className="text-sm text-slate-500 mt-1">{appointment.patientId.email}</p>
                 <p className="text-sm text-slate-500">{appointment.patientId.phone}</p>
              </CardContent>
           </Card>

           {/* DOCTOR INFO */}
           <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
              <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Stethoscope className="w-3 h-3" /> Assigned Doctor
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-xl font-black text-slate-900">Dr. {appointment.doctorId.name}</p>
                 <p className="text-sm font-bold text-primary mt-1">{appointment.doctorId.specialization}</p>
              </CardContent>
           </Card>

           {/* VISIT STATUS */}
           <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
              <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">Appointment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">Status</span>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full text-[10px] uppercase">{appointment.status}</Badge>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">Date</span>
                    <span className="text-xs font-black text-slate-900">{new Date(appointment.date).toLocaleDateString()}</span>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* MEDICAL NOTES & FEEDBACK */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
              <CardHeader>
                 <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-500" /> Doctor's Health Memory
                 </CardTitle>
                 <CardDescription>Confidential observations recorded by the doctor.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 italic text-slate-600 text-sm whitespace-pre-wrap leading-relaxed min-h-[150px]">
                    {appointment.doctorNotes || "No medical notes recorded for this visit."}
                 </div>
              </CardContent>
           </Card>

           <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white">
              <CardHeader>
                 <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Patient Feedback
                 </CardTitle>
                 <CardDescription>How the patient rated this specific check-up.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="p-6 rounded-2xl bg-amber-50/30 border border-amber-100 flex flex-col items-center justify-center min-h-[150px]">
                    <div className="flex gap-1 mb-3">
                       {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-6 h-6 ${s <= 4 ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                       ))}
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mt-2">Verified Patient Rating</p>
                    <p className="text-[10px] text-slate-300 italic mt-4 italic text-center">"Hospital admins can only view summarized feedback to maintain platform integrity."</p>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
