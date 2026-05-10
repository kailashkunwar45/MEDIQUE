"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function HospitalOnboardingPage() {
  const [formData, setFormData] = useState({
    certification: "",
    services: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("mediqueue_session") || "{}");
    if (!session.accessToken || session.role !== "hospital_admin") {
      router.push("/login");
      return;
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const session = JSON.parse(localStorage.getItem("mediqueue_session") || "{}");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hospital-admin/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          certification: formData.certification,
          services: formData.services.split(",").map(s => s.trim()).filter(s => s),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.removeItem("mediqueue_session");
        router.push("/login?message=onboarding_complete");
      } else {
        setError(data.message || "Onboarding failed");
      }
    } catch {
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-[500px] shadow-2xl rounded-2xl border-muted bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Hospital Setup</CardTitle>
          <CardDescription>
            Complete your hospital profile to start managing doctors and patients.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Hospital Certification / License No.</Label>
              <Input 
                placeholder="LIC-12345678" 
                className="rounded-xl bg-muted/30"
                value={formData.certification}
                onChange={(e) => setFormData({ ...formData, certification: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Services Provided (Comma separated)</Label>
              <textarea 
                placeholder="Cardiology, Emergency 24/7, Surgery, Pediatrics..." 
                className="w-full h-32 rounded-xl bg-muted/30 border border-input p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={formData.services}
                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full rounded-xl py-6 text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? "Saving Details..." : "Complete Setup"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
