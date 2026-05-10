"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/authFetch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";

const ALL_SPECIALIZATIONS = [
  "Cardiology", "Dermatology", "ENT", "Gastroenterology",
  "General Practice", "Gynecology", "Neurology", "Oncology",
  "Ophthalmology", "Orthopedics", "Pediatrics", "Psychiatry",
  "Radiology", "Urology"
];

type Doctor = {
  _id: string;
  name: string;
  specialization?: string;
  hospitalId?: string | { _id: string };
  hospitalIds?: string[];
};

type Props = {
  /** Pre-lock the booking to a specific hospital */
  preHospitalId?: string;
  preHospitalName?: string;
  /** Pre-lock the booking to a specific doctor (skips spec/doctor steps) */
  preDoctorId?: string;
  preDoctorName?: string;
  preSpecialization?: string;
  onClose: () => void;
};

function getSession() {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function BookingModal({
  preHospitalId,
  preHospitalName,
  preDoctorId,
  preDoctorName,
  preSpecialization,
  onClose,
}: Props) {
  const session = getSession();

  // Step: "spec" | "doctor" | "confirm"
  const [step, setStep] = useState<"spec" | "doctor" | "confirm">(
    preDoctorId ? "confirm" : preHospitalId ? "spec" : "spec"
  );

  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedSpec, setSelectedSpec] = useState(preSpecialization || "");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(preDoctorId || "");
  const [selectedDoctorName, setSelectedDoctorName] = useState(preDoctorName || "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_later">("pay_later");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  // Load specializations available at this hospital
  useEffect(() => {
    if (!preHospitalId || preDoctorId) return;
    fetch(`${API}/api/hospitals/${preHospitalId}/doctors`)
      .then(r => r.json())
      .then((docs: Doctor[]) => {
        if (!Array.isArray(docs)) return;
        const specs = Array.from(new Set(docs.map(d => d.specialization).filter(Boolean))) as string[];
        setSpecializations(specs.sort());
      })
      .catch(() => {});
  }, [preHospitalId, preDoctorId]);

  // Load doctors for selected spec at this hospital
  useEffect(() => {
    if (!preHospitalId || !selectedSpec || preDoctorId) return;
    fetch(`${API}/api/hospitals/${preHospitalId}/doctors`)
      .then(r => r.json())
      .then((docs: Doctor[]) => {
        if (!Array.isArray(docs)) return;
        const filtered = docs.filter(d => (d.specialization || "").toLowerCase() === selectedSpec.toLowerCase());
        setDoctors(filtered);
        if (filtered.length > 0) {
          setSelectedDoctorId(filtered[0]._id);
          setSelectedDoctorName(filtered[0].name);
        }
      })
      .catch(() => {});
  }, [selectedSpec, preHospitalId, preDoctorId]);

  const bookAppointment = async () => {
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!selectedDoctorId) throw new Error("Please select a doctor.");
      if (!preHospitalId) throw new Error("Hospital not found.");

      await authFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          hospitalId: preHospitalId,
          doctorId: selectedDoctorId,
          date: new Date(date).toISOString(),
          paymentMethod,
        }),
      });
      setInfo("✅ Appointment booked! Visit your dashboard to track it.");
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session?.accessToken) {
    return (
      <ModalShell onClose={onClose} title="Book Appointment">
        <p className="text-sm text-rose-400">You must be logged in as a patient to book.</p>
        <Button className="w-full mt-4 rounded-xl" onClick={onClose}>Close</Button>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title="Book Appointment">
      {/* ── STEP 1: Choose Specialization ── */}
      {step === "spec" && !preDoctorId && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Services provided by</p>
            <p className="text-base font-bold mt-0.5">{preHospitalName}</p>
          </div>
          {specializations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Loading available specializations...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {specializations.map(s => (
                <button
                  key={s}
                  onClick={() => { setSelectedSpec(s); setStep("doctor"); }}
                  className="text-xs font-semibold px-3 py-3 rounded-xl border border-muted bg-muted/10 hover:border-primary/40 hover:bg-primary/5 text-left transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full rounded-xl text-xs" onClick={onClose}>Cancel</Button>
        </div>
      )}

      {/* ── STEP 2: Choose Doctor ── */}
      {step === "doctor" && (
        <div className="space-y-4">
          <div>
            <button onClick={() => setStep("spec")} className="text-xs text-primary hover:underline">← Change specialization</button>
            <p className="text-sm font-semibold mt-1">{selectedSpec} specialists at {preHospitalName}</p>
          </div>
          {doctors.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No doctors found for this specialization.</p>
          ) : (
            <div className="space-y-2">
              {doctors.map(d => (
                <button
                  key={d._id}
                  onClick={() => { setSelectedDoctorId(d._id); setSelectedDoctorName(d.name); setStep("confirm"); }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${selectedDoctorId === d._id ? "border-primary bg-primary/10 text-primary" : "border-muted bg-muted/10 hover:border-primary/30"}`}
                >
                  {d.name}
                  {d.specialization && <span className="text-xs text-muted-foreground ml-2">· {d.specialization}</span>}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full rounded-xl text-xs" onClick={onClose}>Cancel</Button>
        </div>
      )}

      {/* ── STEP 3: Confirm ── */}
      {step === "confirm" && (
        <div className="space-y-4">
          {!preDoctorId && (
            <button onClick={() => setStep("doctor")} className="text-xs text-primary hover:underline">← Change doctor</button>
          )}

          {/* Summary */}
          <div className="rounded-xl border border-muted bg-muted/10 p-4 text-sm space-y-1">
            <div><span className="text-muted-foreground text-xs">Hospital: </span><strong>{preHospitalName}</strong></div>
            {selectedSpec && <div><span className="text-muted-foreground text-xs">Specialization: </span><strong>{selectedSpec}</strong></div>}
            <div><span className="text-muted-foreground text-xs">Doctor: </span><strong>{selectedDoctorName || preDoctorName}</strong></div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Appointment Date</Label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl bg-background border border-muted px-4 py-3 text-sm outline-none focus:border-primary [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Payment</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["online", "pay_later"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-3 text-xs font-bold rounded-xl border transition-all ${paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-muted/10 border-muted hover:border-primary/30"}`}
                >
                  {m === "online" ? "💳 Pay Now" : "💵 Pay Later"}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</div>}
          {info && <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">{info}</div>}

          {info ? (
            <Button className="w-full rounded-xl" onClick={onClose}>Go to Dashboard</Button>
          ) : (
            <Button className="w-full rounded-xl" onClick={bookAppointment} disabled={loading}>
              {loading ? "Booking..." : "Confirm Appointment"}
            </Button>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-muted rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
