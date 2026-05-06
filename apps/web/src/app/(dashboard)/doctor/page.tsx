"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
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

export default function DoctorDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queueStatus, setQueueStatus] = useState<{ currentToken: number; totalTokens: number } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [queueId, setQueueId] = useState("");
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState<string>("");

  useEffect(() => {
    const raw = localStorage.getItem("mediqueue_session");
    if (raw) {
      try {
        const s = JSON.parse(raw) as Session;
        setSession(s);
      } catch {
        // ignore
      }
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005");
    setSocket(socketInstance);

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

  const refreshQueue = async () => {
    setApiError("");
    setApiResult(null);
    try {
      if (!session?.hospitalId) throw new Error("This doctor account has no hospitalId");
      const qs = new URLSearchParams({
        hospitalId: String(session.hospitalId),
        doctorId: String(session._id),
        date: new Date().toISOString(),
      });
      const q = await authFetch(`/api/queues/status?${qs.toString()}`);
      setApiResult(q);
      setQueueStatus({ currentToken: q.currentToken, totalTokens: q.totalTokens });
    } catch (e: any) {
      setApiError(e?.message || "Failed to refresh queue");
    }
  };

  const callNextPatient = async () => {
    setApiError("");
    setApiResult(null);
    try {
      if (!queueId) throw new Error("Enter queueId");
      const result = await authFetch("/api/queues/call-next", {
        method: "POST",
        body: JSON.stringify({ queueId }),
      });
      setApiResult(result);
      if (result?.queue) {
        setQueueStatus({ currentToken: result.queue.currentToken, totalTokens: result.queue.totalTokens });
      }
    } catch (e: any) {
      setApiError(e?.message || "Failed to call next patient");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
        <p className="text-muted-foreground">Manage your live queue and call patients.</p>
      </div>

      {session && (
        <Card className="rounded-2xl border-muted shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Signed in</CardTitle>
            <CardDescription className="font-mono break-all">
              role={session.role} · doctorId={session._id} · hospitalId={String(session.hospitalId || "")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-xl rounded-2xl border-muted">
          <CardHeader>
            <CardTitle>Queue Control</CardTitle>
            <CardDescription>Call the next patient in line</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6">
            <div className="text-sm text-muted-foreground mb-6">Current Patient Token</div>
            <div className="text-6xl font-bold mb-8">{queueStatus?.currentToken || 0}</div>

            <div className="w-full space-y-2 mb-4">
              <Button onClick={refreshQueue} variant="outline" className="w-full rounded-xl">
                Refresh Queue Status (real API)
              </Button>
              <div className="space-y-1">
                <Label>Queue Id</Label>
                <Input value={queueId} onChange={(e) => setQueueId(e.target.value)} placeholder="Mongo ObjectId" />
              </div>
            </div>

            <Button onClick={callNextPatient} className="w-full rounded-xl bg-green-600 hover:bg-green-700" size="lg">
              Call Next Patient
            </Button>

            {apiError && (
              <div className="mt-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 w-full">
                {apiError}
              </div>
            )}
            {apiResult && (
              <pre className="mt-4 text-xs bg-muted/30 border border-muted rounded-xl p-3 overflow-auto max-h-64 w-full">
                {JSON.stringify(apiResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
