"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Hospital = {
  _id: string;
  name: string;
  address: string;
};

export default function DoctorOnboardingPage() {
  const [step, setStep] = useState(1);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [formData, setFormData] = useState({
    degree: "",
    certification: "",
    college: "",
    specialization: "",
    experienceYears: "",
    previousWork: "",
    hospitalIds: [] as string[],
    appointmentFee: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("mediqueue_session") || "{}");
    if (!session.accessToken || session.role !== "doctor") {
      router.push("/login");
      return;
    }

    // Load hospitals for step 2
    fetch(`/api/hospitals`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHospitals(data);
      })
      .catch(() => setError("Failed to load hospitals"));
  }, [router]);

  const toggleHospital = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      hospitalIds: prev.hospitalIds.includes(id)
        ? prev.hospitalIds.filter((h) => h !== id)
        : [...prev.hospitalIds, id],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const session = JSON.parse(localStorage.getItem("mediqueue_session") || "{}");

    try {
      const response = await fetch(`/api/users/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Clear session and redirect to login
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
      <Card className="w-full max-w-[600px] shadow-2xl rounded-2xl border-muted bg-card/50 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center mx-1 text-xs font-bold transition-all ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            Doctor Onboarding
          </CardTitle>
          <CardDescription>
            {step === 1 && "Professional Credentials"}
            {step === 2 && "Hospitals You Represent"}
            {step === 3 && "Review & Complete"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Degree Name</Label>
                <Input
                  placeholder="MBBS, MD, etc."
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Certification</Label>
                <Input
                  placeholder="Board Certified, etc."
                  value={formData.certification}
                  onChange={(e) => setFormData({ ...formData, certification: e.target.value })}
                  className="rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>College/Institution</Label>
                <Input
                  placeholder="Harvard Medical School, etc."
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  className="rounded-xl bg-muted/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Field of Specialization</Label>
                  <Input
                    placeholder="Cardiology, etc."
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="rounded-xl bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Years of Experience</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                    className="rounded-xl bg-muted/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Appointment Fee (Charge for one encounter in USD)</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={formData.appointmentFee}
                  onChange={(e) => setFormData({ ...formData, appointmentFee: e.target.value })}
                  className="rounded-xl bg-muted/30 border-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Previous Working Experience (Where have you worked?)</Label>
                <textarea
                  placeholder="City Hospital, Private Clinic, etc."
                  className="w-full h-24 rounded-xl bg-muted/30 border border-input p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.previousWork}
                  onChange={(e) => setFormData({ ...formData, previousWork: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label>Select the hospitals you represent (Multiple selection allowed)</Label>
              <div className="grid gap-2 max-h-[300px] overflow-y-auto p-1">
                {hospitals.map((h) => (
                  <button
                    key={h._id}
                    onClick={() => toggleHospital(h._id)}
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                      formData.hospitalIds.includes(h._id)
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-muted/30 border-muted hover:border-primary/50"
                    }`}
                  >
                    <span className="font-bold text-sm">{h.name}</span>
                    <span className="text-xs text-muted-foreground">{h.address}</span>
                  </button>
                ))}
              </div>
              {formData.hospitalIds.length === 0 && (
                <p className="text-xs text-amber-400">Please select at least one hospital.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between border-b border-muted pb-1">
                  <span className="text-muted-foreground">Specialization</span>
                  <span className="font-bold">{formData.specialization}</span>
                </div>
                <div className="flex justify-between border-b border-muted pb-1">
                  <span className="text-muted-foreground">Degree</span>
                  <span className="font-bold">{formData.degree}</span>
                </div>
                <div className="flex justify-between border-b border-muted pb-1">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="font-bold">{formData.experienceYears} Years</span>
                </div>
                <div className="flex justify-between border-b border-muted pb-1">
                  <span className="text-muted-foreground">Hospitals</span>
                  <span className="font-bold">{formData.hospitalIds.length} Selected</span>
                </div>
                <div className="flex justify-between border-b border-muted pb-1">
                  <span className="text-muted-foreground">Appointment Fee</span>
                  <span className="font-bold text-primary">${formData.appointmentFee}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center italic">
                By clicking complete, you confirm that all information provided is accurate and truthful.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-3">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl flex-1 py-6">
              Back
            </Button>
          ) : (
            <div className="flex-1" />
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && formData.hospitalIds.length === 0}
              className="rounded-xl flex-1 py-6 font-bold shadow-lg shadow-primary/20"
            >
              Next Step
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl flex-1 py-6 font-bold shadow-lg shadow-primary/20"
            >
              {loading ? "Processing..." : "Complete Onboarding"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
