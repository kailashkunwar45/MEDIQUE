"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "hospital_admin" | "super_admin";
  hospitalId?: string;
  accessToken: string;
};

export default function PatientDashboard() {
  const [queueStatus, setQueueStatus] = useState<{ currentToken: number; totalTokens: number } | null>(null);
  const [myToken, setMyToken] = useState<number | null>(null);
  const [paymentStep, setPaymentStep] = useState<'none' | 'selecting' | 'processing' | 'success'>('none');
  const [session, setSession] = useState<Session | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastAppointmentId, setLastAppointmentId] = useState<string | null>(null);
  const [lastQueueId, setLastQueueId] = useState<string | null>(null);
  const [khaltiTxnId, setKhaltiTxnId] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState<string>("");

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (raw) {
      try {
        const s = JSON.parse(raw) as Session;
        setSession(s);
        if (s.hospitalId) setHospitalId(String(s.hospitalId));
      } catch {
        // ignore
      }
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005");

    socketInstance.emit("joinQueue", { hospitalId: "1", doctorId: "1" });

    socketInstance.on("queueUpdated", (data) => {
      setQueueStatus({ currentToken: data.currentToken, totalTokens: data.totalTokens });
    });

    return () => {
      socketInstance.disconnect();
    };
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

  const bookRealAppointment = async () => {
    setApiError("");
    setApiResult(null);
    try {
      const result = await authFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId,
          hospitalId,
          date: new Date(date).toISOString(),
        }),
      });
      setApiResult(result);
      setLastAppointmentId(result?.appointment?._id || null);
      setLastQueueId(result?.queue?._id || null);
      if (result?.appointment?.tokenNumber) setMyToken(result.appointment.tokenNumber);
    } catch (e: any) {
      setApiError(e?.message || "Failed to book appointment");
    }
  };

  const loadQueueStatus = async () => {
    setApiError("");
    setApiResult(null);
    try {
      const qs = new URLSearchParams({
        hospitalId,
        doctorId,
        date: new Date(date).toISOString(),
      });
      const result = await authFetch(`/api/queues/status?${qs.toString()}`);
      setApiResult(result);
      setQueueStatus({ currentToken: result.currentToken, totalTokens: result.totalTokens });
    } catch (e: any) {
      setApiError(e?.message || "Failed to load queue status");
    }
  };

  const initiateBooking = () => {
    setPaymentStep('selecting');
  };

  const processPayment = async (provider: string) => {
    setPaymentStep('processing');
    setApiError("");
    setApiResult(null);
    try {
      if (!lastAppointmentId) {
        throw new Error("Book a real appointment first (it creates an appointmentId).");
      }

      if (provider === "khalti") {
        const init = await authFetch("/api/payments/khalti/initiate", {
          method: "POST",
          body: JSON.stringify({ appointmentId: lastAppointmentId, amount: 500 }),
        });
        setKhaltiTxnId(init.transactionId || null);
        setApiResult(init);

        // simulate verification success (demo)
        if (init.transactionId) {
          const verified = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/khalti/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "demo_token", amount: 500, transactionId: init.transactionId }),
          }).then((r) => r.json());
          setApiResult({ init, verified });
        }
      } else if (provider === "esewa") {
        const init = await authFetch("/api/payments/esewa/initiate", {
          method: "POST",
          body: JSON.stringify({ appointmentId: lastAppointmentId, amount: 500 }),
        });
        setApiResult(init);

        // simulate verification success (demo)
        if (init.transactionId) {
          const verified = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/esewa/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: init.transactionId, refId: "demo_ref" }),
          }).then((r) => r.json());
          setApiResult({ init, verified });
        }
      }

      setPaymentStep("success");
    } catch (e: any) {
      setPaymentStep("none");
      setApiError(e?.message || "Payment failed");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Patient Dashboard</h1>
        <p className="text-muted-foreground">Manage your appointments and track live queues.</p>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-xl rounded-2xl border-muted">
          <CardHeader>
            <CardTitle>Book Appointment</CardTitle>
            <CardDescription>Book a real appointment (requires doctorId + hospitalId)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="space-y-1">
                <Label>Hospital Id</Label>
                <Input value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} placeholder="Mongo ObjectId" />
              </div>
              <div className="space-y-1">
                <Label>Doctor Id</Label>
                <Input value={doctorId} onChange={(e) => setDoctorId(e.target.value)} placeholder="Mongo ObjectId" />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="flex gap-2">
                <Button onClick={bookRealAppointment} className="rounded-xl" disabled={!session?.accessToken}>
                  Book Real Appointment
                </Button>
                <Button onClick={loadQueueStatus} variant="outline" className="rounded-xl" disabled={!session?.accessToken}>
                  Refresh Queue
                </Button>
              </div>
              {(lastAppointmentId || lastQueueId) && (
                <div className="text-xs text-muted-foreground">
                  Appointment: <span className="font-mono">{lastAppointmentId || "-"}</span><br />
                  Queue: <span className="font-mono">{lastQueueId || "-"}</span>
                </div>
              )}
            </div>

            {paymentStep === 'none' && (
              <Button onClick={initiateBooking} className="w-full rounded-xl" size="lg">
                Book & Pay
              </Button>
            )}
            
            {paymentStep === 'selecting' && (
              <div className="space-y-4">
                <p className="text-sm text-center">Select Payment Method:</p>
                <Button onClick={() => processPayment('khalti')} className="w-full bg-purple-600 hover:bg-purple-700">Pay with Khalti</Button>
                <Button onClick={() => processPayment('esewa')} className="w-full bg-green-600 hover:bg-green-700">Pay with eSewa</Button>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="text-center text-sm py-4 animate-pulse">
                Processing Payment securely...
              </div>
            )}

            {paymentStep === 'success' && myToken && (
              <div className="text-center space-y-2">
                <div className="text-green-500 font-bold mb-2">✓ Payment Successful</div>
                <p className="text-sm">Your Token Number:</p>
                <p className="text-4xl font-bold text-primary">{myToken}</p>
              </div>
            )}

            {apiError && (
              <div className="mt-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                {apiError}
              </div>
            )}
            {apiResult && (
              <pre className="mt-4 text-xs bg-muted/30 border border-muted rounded-xl p-3 overflow-auto max-h-64">
                {JSON.stringify(apiResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl rounded-2xl border-muted bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">Live Queue Tracker</CardTitle>
            <CardDescription>Dr. Smith - General Physician</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <div className="text-sm text-muted-foreground">Currently Serving Token</div>
              <div className="text-7xl font-bold text-primary animate-pulse">
                {queueStatus?.currentToken || 0}
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                Total in Queue: {queueStatus?.totalTokens || 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
