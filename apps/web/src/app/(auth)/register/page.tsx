"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "PATIENT",
    hospitalId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem(
          "mediqueue_session",
          JSON.stringify({
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.role,
            hospitalId: data.hospitalId,
            hospitalIds: data.hospitalIds,
            isOnboarded: data.isOnboarded,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          })
        );

        // Role-based redirect
        if (data.role === "doctor" && !data.isOnboarded) {
          router.push("/doctor/onboarding");
          return;
        }

        const roleRedirects: Record<string, string> = {
          patient: "/patient",
          doctor: "/doctor",
          hospital_admin: "/admin",
          super_admin: "/superadmin",
        };
        router.push(roleRedirects[data.role] || "/");
      } else {
        setError(data.message || "Registration failed");
      }
    } catch {
      setError("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background Wallpaper */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/wallpaper.png")' }}
      />
      <div className="absolute inset-0 z-0 bg-black/20 backdrop-blur-[2px]" />

      <Card className="relative z-10 w-full max-w-[450px] shadow-2xl rounded-[2.5rem] border-white/10 bg-black/40 backdrop-blur-2xl p-2">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="MediQueue Logo" className="w-20 h-20 object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Join MediQueue</CardTitle>
          <CardDescription>
            Choose your role and enter your details to get started
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Select Your Role</Label>
              <div className="grid grid-cols-2 gap-2">
                {["PATIENT", "DOCTOR", "HOSPITAL_ADMIN"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, role })}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                      formData.role === role 
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                        : "bg-muted/50 text-muted-foreground border-muted hover:border-primary/50"
                    }`}
                  >
                    {role.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                placeholder="John Doe" 
                className="rounded-xl bg-muted/30"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="john@example.com" 
                className="rounded-xl bg-muted/30"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                className="rounded-xl bg-muted/30"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            {(formData.role === "DOCTOR" || formData.role === "HOSPITAL_ADMIN") && (
              <div className="space-y-2">
                <Label htmlFor="hospitalId">Hospital Id (optional)</Label>
                <Input
                  id="hospitalId"
                  placeholder="Mongo ObjectId (leave empty to auto-create)"
                  className="rounded-xl bg-muted/30 font-mono"
                  value={formData.hospitalId}
                  onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full rounded-xl py-6 text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
            <div className="text-sm text-muted-foreground text-center">
              Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Login</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
