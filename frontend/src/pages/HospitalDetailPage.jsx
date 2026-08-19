import { useEffect, useState } from "react";
import { useRouter } from "@/hooks/useRouter";
import { useSearchParams } from "@/hooks/useSearchParams";
import { Suspense } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BookingModal from "@/components/BookingModal";
function Stars({ value, interactive, onChange }) {
    return (<span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (<button key={s} type="button" disabled={!interactive} onClick={() => onChange?.(s)} className={`text-xl ${interactive ? "hover:scale-110 transition-transform cursor-pointer" : "cursor-default"} ${s <= Math.round(value) ? "text-amber-400" : "text-muted-foreground/30"}`}>
          ★
        </button>))}
    </span>);
}
function getSession() {
    const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function HospitalDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const router = useRouter();
    const [session, setSession] = useState(null);
    const [data, setData] = useState(null);
    const [reviews, setReviews] = useState([]);
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
    const loadData = () => {
        const s = getSession();
        if (!id)
            return;
        setLoading(true);
        const hospitalFetch = fetch(`/api/hospitals/${id}`, {
            headers: s?.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {},
        }).then((r) => r.json());
        const reviewsFetch = fetch(`/api/hospitals/${id}/reviews`, {
            headers: s?.accessToken ? { Authorization: `Bearer ${s.accessToken}` } : {},
        }).then((r) => r.json());
        // Check if patient has a completed appointment at this hospital
        const apptFetch = s?.accessToken && s.role === 'patient'
            ? fetch(`/api/appointments/my`, {
                headers: { Authorization: `Bearer ${s.accessToken}` }
            }).then((r) => r.json()).catch(() => [])
            : Promise.resolve([]);
        Promise.all([hospitalFetch, reviewsFetch, apptFetch])
            .then(([hospitalRes, reviewsRes, appts]) => {
            if (hospitalRes?.hospital)
                setData(hospitalRes);
            else
                setError(hospitalRes?.message || "Hospital not found");
            if (Array.isArray(reviewsRes?.reviews))
                setReviews(reviewsRes.reviews);
            if (Array.isArray(appts)) {
                const hasCompleted = appts.some((a) => String(a.hospitalId?._id || a.hospitalId) === String(id) && a.status === 'completed');
                setCanReview(hasCompleted);
            }
        })
            .catch(() => setError("Failed to load hospital data"))
            .finally(() => setLoading(false));
    };
    useEffect(() => { loadData(); }, [id]);
    const submitReview = async () => {
        setReviewError("");
        setReviewInfo("");
        setSubmitting(true);
        try {
            const res = await fetch(`/api/hospitals/${id}/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify({ rating, comment }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json?.message || "Failed to submit review");
            setReviewInfo("Review submitted! Thank you.");
            setComment("");
            loadData();
        }
        catch (e) {
            setReviewError(e?.message || "Error submitting review");
        }
        finally {
            setSubmitting(false);
        }
    };
    if (loading)
        return (<div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/>
    </div>);
    if (error || !data)
        return (<div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center gap-4">
      <div className="text-rose-400 text-lg font-semibold">{error || "Hospital not found"}</div>
      <Button onClick={() => router.back()} variant="outline" className="rounded-xl">Go Back</Button>
    </div>);
    const { hospital, doctors, stats } = data;
    return (<div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="w-full bg-gradient-to-br from-emerald-500/15 via-primary/5 to-background border-b border-muted px-8 pt-10 pb-8">
        <div className="max-w-5xl mx-auto">
          <Link to="/hospitals" className="text-sm text-primary hover:underline mb-4 inline-block">← All Hospitals</Link>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-primary/20 flex items-center justify-center text-3xl shrink-0 shadow-lg">
              🏥
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{hospital.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{hospital.address}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <a href={`mailto:${hospital.contactEmail}`} className="hover:text-primary transition-colors">✉️ {hospital.contactEmail}</a>
                {hospital.contactPhone && (<a href={`tel:${hospital.contactPhone}`} className="hover:text-primary transition-colors">📞 {hospital.contactPhone}</a>)}
              </div>
              <div className="flex gap-6 mt-3">
                <div>
                  <span className="text-xl font-bold text-amber-400">{stats.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground ml-1">avg rating</span>
                </div>
                <div>
                  <span className="text-xl font-bold">{stats.totalReviews}</span>
                  <span className="text-xs text-muted-foreground ml-1">reviews</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-primary">{doctors.length}</span>
                  <span className="text-xs text-muted-foreground ml-1">doctors</span>
                </div>
              </div>
            </div>
            <Button className="rounded-xl shadow-lg shadow-primary/20" onClick={() => setShowBooking(true)}>Book Appointment</Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid gap-8 lg:grid-cols-3">
        {/* Doctors column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Our Doctors</CardTitle>
              <CardDescription>{doctors.length} doctor{doctors.length !== 1 ? "s" : ""} available</CardDescription>
            </CardHeader>
            <CardContent>
              {doctors.length === 0 ? (<div className="text-sm text-muted-foreground">No doctors listed yet.</div>) : (<div className="space-y-3">
                  {doctors.map((d) => {
                const initials = d.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                return (<div key={d._id} className="flex items-center gap-3 rounded-xl border border-muted bg-muted/10 p-3 hover:border-primary/30 transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm group-hover:text-primary transition-colors">
                            <Link to={`/doctors?id=${d._id}`}>{d.name}</Link>
                          </div>
                          {d.specialization && (<div className="text-xs text-muted-foreground">{d.specialization} {d.appointmentFee ? `· Fee: $${d.appointmentFee}` : ""}</div>)}
                          <div className="text-xs text-muted-foreground">{d.email}</div>
                        </div>
                        <Link to={`/doctors?id=${d._id}`}>
                          <Button size="sm" variant="outline" className="rounded-xl text-xs">Profile</Button>
                        </Link>
                      </div>);
            })}
                </div>)}
            </CardContent>
          </Card>

          {/* Reviews list */}
          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Patient Reviews
                <Stars value={stats.avgRating}/>
                <span className="text-amber-400 font-bold">{stats.avgRating.toFixed(1)}</span>
              </CardTitle>
              <CardDescription>{stats.totalReviews} review{stats.totalReviews !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (<div className="text-sm text-muted-foreground">No reviews yet. Be the first!</div>) : (<div className="space-y-3">
                  {reviews.map((r) => (<div key={r._id} className="rounded-xl border border-muted bg-muted/10 p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-semibold text-sm">{r.patientId?.name || "Patient"}</div>
                        <div className="flex items-center gap-1">
                          <Stars value={r.rating}/>
                          <span className="text-xs text-muted-foreground ml-1">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    </div>))}
                </div>)}
            </CardContent>
          </Card>
        </div>

        {/* Rate hospital column */}
        <div className="space-y-6">
          {session?.role === "patient" && canReview && (<Card className="rounded-2xl border-muted shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rate this Hospital</CardTitle>
                <CardDescription>Share your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviewError && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">{reviewError}</div>}
                {reviewInfo && <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">{reviewInfo}</div>}
                <div className="space-y-1">
                  <Label>Your Rating</Label>
                  <Stars value={rating} interactive onChange={setRating}/>
                </div>
                <div className="space-y-1">
                  <Label>Comment (optional)</Label>
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your experience?" className="rounded-xl"/>
                </div>
                <Button onClick={submitReview} disabled={submitting} className="rounded-xl w-full">
                  {submitting ? "Submitting..." : "Submit Review"}
                </Button>
              </CardContent>
            </Card>)}
          {session?.role === "patient" && !canReview && (<div className="text-xs text-muted-foreground bg-muted/20 border border-muted rounded-2xl p-4 text-center italic">
              🔒 Complete an appointment at this hospital to leave a review.
            </div>)}

          <Card className="rounded-2xl border-muted shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contact &amp; Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>📍</span> <span>{hospital.address}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>✉️</span>
                <a href={`mailto:${hospital.contactEmail}`} className="hover:text-primary transition-colors break-all">{hospital.contactEmail}</a>
              </div>
              {hospital.contactPhone && (<div className="flex items-center gap-2 text-muted-foreground">
                  <span>📞</span>
                  <a href={`tel:${hospital.contactPhone}`} className="hover:text-primary transition-colors">{hospital.contactPhone}</a>
                </div>)}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>⭐</span>
                <span className="capitalize">{hospital.subscriptionTier} tier</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {showBooking && data && (<BookingModal preHospitalId={hospital._id} preHospitalName={hospital.name} onClose={() => setShowBooking(false)}/>)}
    </div>);
}
export default function HospitalDetailPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/></div>}>
      <HospitalDetailContent />
    </Suspense>);
}
