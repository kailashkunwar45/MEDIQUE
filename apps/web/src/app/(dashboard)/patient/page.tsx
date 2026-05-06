"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { io } from "socket.io-client";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "hospital_admin" | "super_admin";
  hospitalId?: string;
  accessToken: string;
  refreshToken?: string;
};

type Hospital = {
  _id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone?: string;
};

type Doctor = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  hospitalId?: string;
};

type Appointment = {
  _id: string;
  doctorId: Doctor;
  hospitalId: Hospital;
  date: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  paymentMethod: "online" | "pay_later";
  paymentStatus: "paid" | "unpaid";
  tokenNumber?: number;
  cancelledAt?: string;
  forfeited?: boolean;
};

type ChatMessage = {
  _id: string;
  appointmentId: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
};

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export default function PatientDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_later">("pay_later");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeChatAppointmentId, setActiveChatAppointmentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  useEffect(() => {
    setSession(getSession());
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

  const loadHospitals = async () => {
    setError("");
    setInfo("");
    try {
      const data = await authFetch("/api/hospitals");
      setHospitals(data);
      if (Array.isArray(data) && data.length && !selectedHospitalId) {
        setSelectedHospitalId(data[0]._id);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load hospitals");
    }
  };

  const loadDoctors = async (hospitalId: string) => {
    setError("");
    setInfo("");
    try {
      if (!hospitalId) return;
      const data = await authFetch(`/api/hospitals/${hospitalId}/doctors`);
      setDoctors(data);
      if (Array.isArray(data) && data.length) {
        setSelectedDoctorId(data[0]._id);
      } else {
        setSelectedDoctorId("");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load doctors");
    }
  };

  const loadMyAppointments = async () => {
    setError("");
    setInfo("");
    try {
      const data = await authFetch("/api/appointments/my");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load appointments");
    }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    void loadHospitals();
    void loadMyAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) return;
    if (!selectedHospitalId) return;
    void loadDoctors(selectedHospitalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospitalId, session?.accessToken]);

  const bookAppointment = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!selectedHospitalId) throw new Error("Select a hospital");
      if (!selectedDoctorId) throw new Error("Select a doctor");

      await authFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          hospitalId: selectedHospitalId,
          doctorId: selectedDoctorId,
          date: new Date(date).toISOString(),
          paymentMethod,
        }),
      });

      setInfo(
        paymentMethod === "online"
          ? "Booked and marked as PAID (online now)."
          : "Booked and marked as UNPAID (pay after checkup)."
      );
      await loadMyAppointments();
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (appointmentId: string) => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await authFetch("/api/appointments/cancel", {
        method: "POST",
        body: JSON.stringify({ appointmentId }),
      });
      setInfo("Booking cancelled. If it was paid, it is forfeited (no refund).");
      await loadMyAppointments();
    } catch (e: any) {
      setError(e?.message || "Cancel failed");
    } finally {
      setLoading(false);
    }
  };

  const openChat = async (appointmentId: string) => {
    setError("");
    setInfo("");
    setActiveChatAppointmentId(appointmentId);
    setMessages([]);

    try {
      const history = await authFetch(`/api/chat/${appointmentId}/messages`);
      setMessages(history?.messages || []);
    } catch (e: any) {
      setError(e?.message || "Cannot open chat");
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005");
    socket.emit("joinChat", { appointmentId, token: session?.accessToken });
    socket.on("message", (msg: ChatMessage) => {
      if (msg.appointmentId !== appointmentId) return;
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("chatError", (p: any) => {
      setError(p?.message || "Chat error");
    });

    // store socket on window for quick reuse/cleanup in this MVP
    (window as any).__mediqueue_chat_socket?.disconnect?.();
    (window as any).__mediqueue_chat_socket = socket;
  };

  const sendChat = async () => {
    setError("");
    const appointmentId = activeChatAppointmentId;
    const text = chatText.trim();
    if (!appointmentId) return;
    if (!text) return;

    const socket = (window as any).__mediqueue_chat_socket;
    if (!socket) {
      setError("Chat socket not connected");
      return;
    }
    socket.emit("sendMessage", { appointmentId, token: session?.accessToken, text });
    setChatText("");
  };

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Patient Dashboard</h1>
        <p className="text-muted-foreground">
          Book appointments, choose payment status (paid/unpaid), cancel with 24-hour rule, and chat after doctor accepts.
        </p>
      </div>

      {session && (
        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Signed in</CardTitle>
            <CardDescription className="font-mono break-all">
              role={session.role} · patientId={session._id} · hospitalId={String(session.hospitalId || "")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!session?.accessToken && (
        <div className="text-sm text-rose-400">
          You are not logged in. Go to <a className="underline" href="/login">/login</a>.
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
          {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          {info}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xl rounded-2xl border-muted lg:col-span-1">
          <CardHeader>
            <CardTitle>Book Appointment</CardTitle>
            <CardDescription>Select hospital, doctor, date, and payment option.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="space-y-1">
                <Label>Hospital</Label>
                <select
                  className="w-full rounded-xl bg-muted/30 border border-muted px-3 py-2"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  disabled={!session?.accessToken}
                >
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Doctor</Label>
                <select
                  className="w-full rounded-xl bg-muted/30 border border-muted px-3 py-2"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  disabled={!session?.accessToken}
                >
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <Label>Payment option</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`flex-1 px-3 py-2 text-sm font-semibold rounded-xl border transition-all ${
                      paymentMethod === "online"
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-muted/50 text-muted-foreground border-muted hover:border-primary/50"
                    }`}
                    disabled={!session?.accessToken}
                  >
                    Online now (PAID)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pay_later")}
                    className={`flex-1 px-3 py-2 text-sm font-semibold rounded-xl border transition-all ${
                      paymentMethod === "pay_later"
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-muted/50 text-muted-foreground border-muted hover:border-primary/50"
                    }`}
                    disabled={!session?.accessToken}
                  >
                    Pay after checkup (UNPAID)
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={bookAppointment}
              className="w-full rounded-xl"
              size="lg"
              disabled={!session?.accessToken || loading}
            >
              {loading ? "Booking..." : "Book Appointment"}
            </Button>

            <div className="mt-3 text-xs text-muted-foreground">
              Cancel rule: cannot cancel within 24 hours. If you paid, cancellation forfeits money (no refund).
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl rounded-2xl border-muted lg:col-span-2">
          <CardHeader>
            <CardTitle>My Bookings</CardTitle>
            <CardDescription>Pending needs doctor acceptance before chat opens.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-4">
              <Button variant="outline" className="rounded-xl" onClick={loadMyAppointments} disabled={!session?.accessToken || loading}>
                Refresh
              </Button>
              <Link href="/profile" className="text-sm text-primary font-semibold hover:underline">
                My Profile
              </Link>
            </div>

            {appointments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bookings yet.</div>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a._id} className="rounded-2xl border border-muted p-4 bg-muted/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          <Link href={`/doctors/${a.doctorId?._id}`} className="hover:underline">
                            {a.doctorId?.name || "Doctor"}
                          </Link>{" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          <span className="text-sm text-muted-foreground">{a.hospitalId?.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono break-all">
                          {new Date(a.date).toLocaleString()} · token {a.tokenNumber ?? "-"} · status {a.status} ·{" "}
                          {a.paymentStatus.toUpperCase()} ({a.paymentMethod})
                        </div>
                        {a.forfeited && (
                          <div className="text-xs text-amber-400 mt-1">Paid booking was cancelled: money forfeited (no refund).</div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {a.status !== "cancelled" && a.status !== "completed" && (
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => cancelBooking(a._id)}
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                        )}
                        {a.status === "confirmed" && (
                          <Button className="rounded-xl" onClick={() => openChat(a._id)}>
                            Open Chat
                          </Button>
                        )}
                      </div>
                    </div>

                    {activeChatAppointmentId === a._id && (
                      <div className="mt-4 rounded-xl border border-muted bg-background/40 p-3">
                        <div className="text-sm font-semibold mb-2">Chat (closes automatically after 24h)</div>
                        <div className="max-h-56 overflow-auto space-y-2 pr-1">
                          {messages.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No messages yet.</div>
                          ) : (
                            messages.map((m) => (
                              <div key={m._id} className="text-sm">
                                <span className="text-xs text-muted-foreground">
                                  {m.senderRole} · {new Date(m.createdAt).toLocaleTimeString()}
                                </span>
                                <div className="whitespace-pre-wrap">{m.text}</div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            placeholder="Type a message…"
                            className="rounded-xl"
                          />
                          <Button onClick={sendChat} className="rounded-xl">
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
