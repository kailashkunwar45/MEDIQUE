"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BookingModal from "@/components/BookingModal";

type Session = {
  _id: string;
  name: string;
  role: string;
  accessToken: string;
};

type Doctor = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  appointmentFee?: number;
  hospitalId?: { _id: string; name: string; address: string; contactPhone?: string; contactEmail?: string };
};

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  patientId?: { name: string };
};

type DoctorProfileData = {
  doctor: Doctor;
  stats: { totalBookings: number; avgRating: number; totalReviews: number };
  reviews: Review[];
};

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= Math.round(value) ? "text-amber-400" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </span>
  );
}

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canReview, setCanReview] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewInfo, setReviewInfo] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setSession(getSession()); }, []);

  const loadProfile = () => {
    if (!id) return;
    setLoading(true);
    const s = getSession();

    const profileFetch = fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/doctors/${id}`)
      .then((r) => r.json());

    // If patient is logged in, check for completed appointments with this doctor
    const apptFetch = s?.accessToken && s.role === 'patient'
      ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/appointments/my`, {
          headers: { Authorization: `Bearer ${s.accessToken}` }
        }).then((r) => r.json()).catch(() => [])
      : Promise.resolve([]);

    Promise.all([profileFetch, apptFetch])
      .then(([d, appts]) => {
        if (d?.doctor) setData(d);
        else setError(d?.message || "Doctor not found");
        if (Array.isArray(appts)) {
          const hasCompleted = appts.some(
            (a: any) => String(a.doctorId?._id || a.doctorId) === String(id) && a.status === 'completed'
          );
          setCanReview(hasCompleted);
        }
      })
      .catch(() => setError("Failed to load doctor profile"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, [id]);

  const submitReview = async () => {
    setReviewError(""); setReviewInfo(""); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ doctorId: id, rating, comment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to submit review");
      setReviewInfo("Review submitted! Thank you.");
      setComment("");
      loadProfile();
    } catch (e: any) {
      setReviewError(e?.message || "Error submitting review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center gap-4">
      <div className="text-rose-400 text-lg font-semibold">{error || "Doctor not found"}</div>
      <Button onClick={() => router.back()} variant="outline" className="rounded-xl">Go Back</Button>
    </div>
  );

  const { doctor, stats, reviews } = data;
  const initials = doctor.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="w-full bg-gradient-to-br from-primary/20 via-primary/10 to-background border-b border-muted pb-8 pt-10 px-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/patient" className="text-sm text-primary hover:underline mb-6 inline-block">← Back to Dashboard</Link>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-xl shadow-primary/20 shrink-0">
              {initials}
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{doctor.name}</h1>
               {doctor.specialization && (
                 <div className="mt-1 inline-flex items-center gap-2">
                   <div className="bg-primary/10 text-primary text-sm font-semibold px-3 py-0.5 rounded-full border border-primary/20">
                     {doctor.specialization}
                   </div>
                   {doctor.appointmentFee && (
                     <div className="bg-emerald-500/10 text-emerald-600 text-sm font-semibold px-3 py-0.5 rounded-full border border-emerald-500/20">
                       Fee: ${doctor.appointmentFee}
                     </div>
                   )}
                 </div>
               )}
              {doctor.hospitalId && (
                <p className="text-muted-foreground mt-2 text-sm">
                  🏥{" "}
                  <Link href={`/hospitals/${doctor.hospitalId._id}`} className="hover:underline text-foreground font-medium">
                    {doctor.hospitalId.name}
                  </Link>
                  {doctor.hospitalId.address && <span> · {doctor.hospitalId.address}</span>}
                </p>
              )}
              {/* Stats row */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.totalBookings}</div>
                  <div className="text-xs text-muted-foreground">Total Patients</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.avgRating.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalReviews}</div>
                  <div className="text-xs text-muted-foreground">Reviews</div>
                </div>
              </div>
            </div>
            {session?.role === "patient" && (
              <Button
                className="rounded-xl shadow-lg shadow-primary/20"
                onClick={() => setShowBooking(true)}
              >
                Book Appointment
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 md:col-span-1">
          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span>✉️</span>
                <a href={`mailto:${doctor.email}`} className="hover:underline text-primary break-all">{doctor.email}</a>
              </div>
              {doctor.phone && (
                <div className="flex items-center gap-2">
                  <span>📞</span>
                  <a href={`tel:${doctor.phone}`} className="hover:underline">{doctor.phone}</a>
                </div>
              )}
              {doctor.hospitalId?.contactPhone && (
                <div className="flex items-center gap-2">
                  <span>🏥</span>
                  <span className="text-muted-foreground text-xs">{doctor.hospitalId.contactPhone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {doctor.bio && (
            <Card className="rounded-2xl border-muted shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Career &amp; About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{doctor.bio}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Reviews */}
        <div className="space-y-6 md:col-span-2">
          {session?.role === "patient" && canReview && (
            <Card className="rounded-2xl border-muted shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Leave a Review</CardTitle>
                <CardDescription>Rate your experience with this doctor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviewError && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">{reviewError}</div>}
                {reviewInfo && <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">{reviewInfo}</div>}
                <div className="space-y-1">
                  <Label>Rating</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className={`text-2xl transition-transform hover:scale-110 ${s <= rating ? "text-amber-400" : "text-muted-foreground/30"}`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-sm text-muted-foreground ml-2 self-center">{rating}/5</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Comment (optional)</Label>
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience..." className="rounded-xl" />
                </div>
                <Button onClick={submitReview} disabled={submitting} className="rounded-xl w-full">
                  {submitting ? "Submitting..." : "Submit Review"}
                </Button>
              </CardContent>
            </Card>
          )}
          {session?.role === "patient" && !canReview && (
            <div className="text-xs text-muted-foreground bg-muted/20 border border-muted rounded-2xl p-4 text-center italic">
              🔒 Complete an appointment with this doctor to leave a review.
            </div>
          )}

          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Patient Reviews
                <span className="ml-1 text-amber-400 font-bold">{stats.avgRating.toFixed(1)}</span>
                <Stars value={stats.avgRating} />
              </CardTitle>
              <CardDescription>{stats.totalReviews} review{stats.totalReviews !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-sm text-muted-foreground">No reviews yet.</div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r._id} className="rounded-xl border border-muted bg-muted/10 p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-semibold text-sm">{r.patientId?.name || "Patient"}</div>
                        <div className="flex items-center gap-1">
                          <Stars value={r.rating} />
                          <span className="text-xs text-muted-foreground ml-1">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {showBooking && data?.doctor.hospitalId && (
        <BookingModal
          preHospitalId={data.doctor.hospitalId._id}
          preHospitalName={data.doctor.hospitalId.name}
          preDoctorId={data.doctor._id}
          preDoctorName={data.doctor.name}
          preSpecialization={data.doctor.specialization}
          onClose={() => setShowBooking(false)}
        />
      )}
    </div>
  );
}
