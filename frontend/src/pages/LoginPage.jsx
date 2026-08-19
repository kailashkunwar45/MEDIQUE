import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useRouter } from "@/hooks/useRouter";
import { useSearchParams } from "@/hooks/useSearchParams";
import { Suspense } from "react";
function LoginContent() {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const message = searchParams.get("message");
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("mediqueue_session", JSON.stringify({
                    _id: data._id,
                    name: data.name,
                    email: data.email,
                    role: data.role,
                    hospitalId: data.hospitalId,
                    hospitalIds: data.hospitalIds,
                    isOnboarded: data.isOnboarded,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                }));
                // Role-based redirect
                if (data.role === "doctor" && !data.isOnboarded) {
                    router.push("/doctor/onboarding");
                    return;
                }
                const roleRedirects = {
                    patient: "/patient",
                    doctor: "/doctor",
                    hospital_admin: "/admin",
                    super_admin: "/superadmin",
                };
                router.push(roleRedirects[data.role] || "/");
            }
            else {
                setError(data.message || "Login failed");
            }
        }
        catch {
            setError("Server connection failed");
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background Wallpaper */}
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/wallpaper.png")' }}/>
      <div className="absolute inset-0 z-0 bg-black/20 backdrop-blur-[2px]"/>

      <Card className="relative z-10 w-full max-w-[400px] shadow-2xl rounded-[2.5rem] border-white/10 bg-black/40 backdrop-blur-2xl p-2">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="MediQueue Logo" className="w-20 h-20 object-contain"/>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">Welcome Back</CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboard
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {message === "onboarding_complete" && (<div className="p-3 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                Onboarding complete! Please login. Your account will be accessible once approved by the Super Admin.
              </div>)}
            {error && (<div className="p-3 text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                {error}
              </div>)}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" className="rounded-xl bg-muted/30" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" className="rounded-xl bg-muted/30" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required/>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full rounded-xl py-6 text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </Button>
            <div className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account? <Link href="/register" className="text-primary font-bold hover:underline">Sign up</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>);
}
export default function LoginPage() {
    return (<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <LoginContent />
    </Suspense>);
}
