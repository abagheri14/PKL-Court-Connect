import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Star, MapPin, Clock, Users, Phone, Globe, CheckCircle, Navigation, Calendar, ChevronRight, Send, Loader2, Activity, Camera, Trophy, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";
import { MapView, mapboxgl } from "@/components/Map";
import { useTranslation } from "react-i18next";

function getTimeAgo(date: Date, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("court.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("court.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("court.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("court.daysAgo", { count: days });
  return t("court.monthsAgo", { count: Math.floor(days / 30) });
}

export default function CourtDetail() {
  const { selectedCourtId, navigate, goBack } = useApp();
  const { t, i18n } = useTranslation();
  const courtQuery = trpc.courts.getById.useQuery(
    { courtId: selectedCourtId! },
    { enabled: !!selectedCourtId }
  );
  const reviewsQuery = trpc.courts.getReviews.useQuery(
    { courtId: selectedCourtId! },
    { enabled: !!selectedCourtId }
  );
  const addReviewMutation = trpc.courts.addReview.useMutation({
    onSuccess: () => {
      reviewsQuery.refetch();
      courtQuery.refetch();
      toast.success(t("court.reviewSubmitted"));
    },
    onError: (err) => toast.error(err.message),
  });

  const court: any = courtQuery.data;
  const reviews: any[] = reviewsQuery.data ?? [];
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("");
  const [bookingEndTime, setBookingEndTime] = useState("");
  const [bookingCourtNum, setBookingCourtNum] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const checkInMutation = trpc.achievements.claimQuest.useMutation({
    onSuccess: () => { setCheckedIn(true); toast.success(t("court.checkedIn")); },
  });

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Court photos, leaderboard, bookings
  const photosQuery = trpc.courts.getPhotos.useQuery(
    { courtId: selectedCourtId! },
    { enabled: !!selectedCourtId }
  );
  const leaderboardQuery = trpc.courts.leaderboard.useQuery(
    { courtId: selectedCourtId! },
    { enabled: !!selectedCourtId }
  );
  const bookingsQuery = trpc.courts.getBookings.useQuery(
    { courtId: selectedCourtId! },
    { enabled: !!selectedCourtId }
  );
  const createBookingMutation = trpc.courts.createBooking.useMutation({
    onSuccess: () => {
      bookingsQuery.refetch();
      setShowBookingForm(false);
      setBookingDate(""); setBookingStartTime(""); setBookingEndTime(""); setBookingCourtNum(""); setBookingNotes("");
      toast.success("Court booked!");
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelBookingMutation = trpc.courts.cancelBooking.useMutation({
    onSuccess: () => { bookingsQuery.refetch(); toast.success("Booking cancelled"); },
    onError: (err) => toast.error(err.message),
  });
  const courtPhotos: any[] = photosQuery.data ?? [];
  const leaderboard: any[] = leaderboardQuery.data ?? [];
  const bookings: any[] = bookingsQuery.data ?? [];

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    if (court?.latitude && court?.longitude) {
      const lngLat: [number, number] = [Number(court.longitude), Number(court.latitude)];
      map.setCenter(lngLat);
      map.setZoom(15);
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker({ color: "#f59e0b" })
        .setLngLat(lngLat)
        .addTo(map);
    }
  }, [court]);

  if (!selectedCourtId || (!court && !courtQuery.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("court.notFound")}</p>
      </div>
    );
  }

  if (courtQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <QueryError message={t("court.failedToLoad")} onRetry={() => courtQuery.refetch()} />
      </div>
    );
  }

  if (courtQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      {/* Header Map */}
      {court?.latitude && court?.longitude ? (
      <div className="relative h-48">
        <MapView
          className="w-full h-full"
          initialCenter={{ lat: Number(court.latitude), lng: Number(court.longitude) }}
          initialZoom={15}
          onMapReady={handleMapReady}
        />
        <div className="absolute top-0 left-0 right-0 px-4 pt-6 flex items-center gap-3 z-10">
          <button onClick={() => goBack()} className="p-2 rounded-full bg-background/30 backdrop-blur">
            <ArrowLeft size={18} />
          </button>
          <span className="ml-auto text-[10px] text-white/60 bg-background/30 backdrop-blur px-2 py-1 rounded-full">
            {court.courtType} · {t("court.courtCount", { count: court.numCourts })}
          </span>
        </div>
      </div>
      ) : (
      <div className="relative h-48 bg-muted/20 flex items-center justify-center">
        <div className="text-center">
          <MapPin size={32} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">{t("court.noMapAvailable")}</p>
        </div>
        <div className="absolute top-0 left-0 right-0 px-4 pt-6 flex items-center gap-3 z-10">
          <button onClick={() => goBack()} className="p-2 rounded-full bg-background/30 backdrop-blur">
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>
      )}

      {/* Info */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="card-elevated rounded-xl p-4 mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-xl font-bold">{court.name}</h1>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin size={10} />
                <span>{court.address}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-secondary/20 px-2 py-1 rounded-full">
              <Star size={14} className="text-secondary" fill="currentColor" />
              <span className="text-sm font-bold text-secondary">{(court.averageRating ?? 0).toFixed(1)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <button
              onClick={() => {
                if (court.latitude && court.longitude) {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${court.latitude},${court.longitude}`, "_blank", "noopener");
                }
              }}
              className="text-center group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-1 group-hover:bg-primary/30 transition-colors">
                <Navigation size={16} className="text-primary" />
              </div>
              <p className="text-xs font-medium text-primary">{t("court.directions")}</p>
              <p className="text-[10px] text-muted-foreground">{court.distance ?? "—"} mi</p>
            </button>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-1">
                <Users size={16} className="text-secondary" />
              </div>
              <p className="text-xs font-medium">{court.numCourts}</p>
              <p className="text-[10px] text-muted-foreground">{t("court.courts")}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-1">
                <Clock size={16} className="text-accent" />
              </div>
              <p className="text-xs font-medium">{court.courtType}</p>
              <p className="text-[10px] text-muted-foreground">{court.surfaceType}</p>
            </div>
          </div>
        </div>

        {/* Hours */}
        <div className="card-elevated rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Clock size={14} className="text-secondary" /> {t("court.info")}
          </h2>
          <p className="text-sm text-muted-foreground">{court.isFree ? t("court.freeToPlay") : court.costInfo}</p>
          <p className="text-sm text-muted-foreground mt-1">{court.lighting ? t("court.lightingAvailable") : t("court.noLighting")}</p>
        </div>

        {/* Amenities */}
        <div className="card-elevated rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">{t("court.amenities")}</h2>
          <div className="flex flex-wrap gap-2">
            {(() => {
              let items: string[] = [];
              try {
                const raw = court.amenities;
                if (Array.isArray(raw)) items = raw;
                else if (typeof raw === "string" && raw.startsWith("[")) items = JSON.parse(raw);
                else if (typeof raw === "string") items = raw.split(",").map((s: string) => s.trim());
              } catch { items = String(court.amenities || "").split(",").map((s: string) => s.trim()); }
              return items.filter(Boolean).map((amenity: string) => (
              <span
                key={amenity}
                className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs flex items-center gap-1"
              >
                <CheckCircle size={10} />
                {amenity}
              </span>
            ));
            })()}
          </div>
        </div>

        {/* Photo Gallery */}
        {courtPhotos.length > 0 && (
        <div className="card-elevated rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Camera size={14} className="text-secondary" /> Photos ({courtPhotos.length})
          </h2>
          <div className="relative">
            <div className="w-full h-40 rounded-lg overflow-hidden bg-muted/20">
              {courtPhotos[photoIndex] && (
                <img
                  src={courtPhotos[photoIndex].photoUrl}
                  alt={courtPhotos[photoIndex].caption || "Court photo"}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {courtPhotos.length > 1 && (
              <div className="flex justify-center gap-1 mt-2">
                {courtPhotos.map((_: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={cn("w-2 h-2 rounded-full transition-colors", i === photoIndex ? "bg-secondary" : "bg-muted-foreground/30")}
                  />
                ))}
              </div>
            )}
          </div>
          {courtPhotos[photoIndex]?.caption && (
            <p className="text-xs text-muted-foreground mt-2">{courtPhotos[photoIndex].caption}</p>
          )}
        </div>
        )}

        {/* Contact */}
        <div className="card-elevated rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">{t("court.details")}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users size={14} />
            <span>{t("court.playersActiveNow", { count: court.activePlayersNow ?? 0 })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock size={14} />
            <span>{t("court.estWait", { minutes: Math.max(0, ((court.activePlayersNow ?? 0) - (court.numberOfCourts ?? 2)) * 10) })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Activity size={14} />
            <span>{t("court.peakHours")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star size={14} />
            <span>{t("court.reviewCount", { count: court.totalReviews ?? reviews.length })}</span>
          </div>
        </div>

        {/* Check In & Schedule */}
        <div className="space-y-3 mb-4">
          <Button
            onClick={() => {
              if (!checkedIn) {
                checkInMutation.mutate({ questId: `court-checkin-${selectedCourtId}`, xp: 25 });
              }
            }}
            disabled={checkedIn || checkInMutation.isPending}
            className={cn(
              "w-full font-semibold py-5 rounded-2xl",
              checkedIn
                ? "bg-green-600 text-white cursor-default"
                : "bg-secondary text-background"
            )}
          >
            <CheckCircle size={16} className="mr-2" />
            {checkedIn ? t("court.checkedInDone") : t("court.checkInXp")}
          </Button>
          <Button variant="outline" className="w-full py-5 rounded-2xl border-primary/30" onClick={() => navigate("createGame")}>
            <Calendar size={16} className="mr-2" /> {t("court.scheduleGameHere")}
          </Button>
        </div>

        {/* Recent Activity */}
        {reviews.length > 0 && (
        <div className="card-elevated rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t("court.recentActivity")}</h2>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {reviews.slice(0, 3).map((review: any) => {
              const reviewDate = review.createdAt ? new Date(review.createdAt) : null;
              const timeAgo = reviewDate ? getTimeAgo(reviewDate, t) : "";
              return (
                <div key={review.id} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    {t("court.leftReview", { name: review.userName ?? review.username ?? t("court.userFallback"), rating: review.rating })}
                  </span>
                  <span className="text-muted-foreground/60">{timeAgo}</span>
                </div>
              );
            })}
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">{t("court.playersCurrentlyActive", { count: court.activePlayersNow ?? 0 })}</span>
            </div>
          </div>
        </div>
        )}

        {/* Reviews Section */}
        <div className="card-elevated rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t("court.reviewsSection", { count: reviews.length })}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-xs text-secondary"
            >
              {showReviewForm ? t("common.cancel") : t("court.writeReview")}
            </Button>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="mb-4 p-3 rounded-xl bg-background/30 border border-border">
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setReviewRating(star)}>
                    <Star
                      size={20}
                      className={cn("transition-colors", star <= reviewRating ? "text-secondary fill-secondary" : "text-muted-foreground/30")}
                    />
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-2">{reviewRating}/5</span>
              </div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder={t("court.sharePlaceholder")}
                className="w-full bg-background/50 rounded-lg p-2 text-xs border border-border min-h-[60px] resize-none focus:outline-none focus:border-secondary mb-2"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (reviewComment.trim()) {
                    addReviewMutation.mutate({
                      courtId: selectedCourtId!,
                      rating: reviewRating,
                      comment: reviewComment,
                    });
                    setReviewComment("");
                    setReviewRating(5);
                    setShowReviewForm(false);
                  }
                }}
                className="w-full bg-secondary text-background text-xs"
              >
                <Send size={12} className="mr-1" /> {t("court.submitReview")}
              </Button>
            </div>
          )}

          {/* Review List */}
          <div className="space-y-3">
            {reviews.map((review: any) => (
              <div key={review.id} className="p-3 rounded-xl bg-background/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar user={{ id: review.userId ?? 0, name: review.userName ?? review.username ?? "User", profilePhotoUrl: review.profilePhotoUrl, hasProfilePhoto: !!review.profilePhotoUrl }} size="sm" showBadges={false} />
                    <span className="text-xs font-medium">{review.userName ?? review.username ?? "User"}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} className={cn(i < review.rating ? "text-secondary fill-secondary" : "text-muted-foreground/20")} />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{review.comment}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}</p>
              </div>
            ))}
          </div>
        </div>

        {/* King of the Court Leaderboard */}
        {leaderboard.length > 0 && (
        <div className="card-elevated rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-[#FFC107]" /> King of the Court
          </h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((entry: any, i: number) => (
              <div key={entry.userId} className="flex items-center gap-3">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  i === 0 ? "bg-[#FFC107]/20 text-[#FFC107]" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-orange-400/20 text-orange-400" : "bg-muted/30 text-muted-foreground"
                )}>
                  {i + 1}
                </span>
                <PlayerAvatar user={{ id: entry.userId, name: entry.name, profilePhotoUrl: entry.profilePhotoUrl, hasProfilePhoto: !!entry.profilePhotoUrl }} size="sm" showBadges={false} />
                <span className="flex-1 text-sm font-medium truncate">{entry.name || "Player"}</span>
                <span className="text-xs text-[#BFFF00] font-bold">{entry.wins}W</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Court Bookings */}
        <div className="card-elevated rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={14} className="text-secondary" /> Court Bookings
            </h2>
            <Button
              size="sm"
              variant={showBookingForm ? "outline" : "default"}
              onClick={() => setShowBookingForm(!showBookingForm)}
              className="h-7 text-xs"
            >
              {showBookingForm ? "Cancel" : "Book Court"}
            </Button>
          </div>

          {/* Booking Form */}
          {showBookingForm && (
            <div className="space-y-3 mb-4 p-3 rounded-lg bg-muted/20 border border-border/30">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background rounded-lg border border-border/40 outline-none focus:border-[#BFFF00]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Start Time</label>
                    <input
                      type="time"
                      value={bookingStartTime}
                      onChange={(e) => setBookingStartTime(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background rounded-lg border border-border/40 outline-none focus:border-[#BFFF00]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">End Time</label>
                    <input
                      type="time"
                      value={bookingEndTime}
                      onChange={(e) => setBookingEndTime(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background rounded-lg border border-border/40 outline-none focus:border-[#BFFF00]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Court # (optional)</label>
                  <input
                    type="number"
                    value={bookingCourtNum}
                    onChange={(e) => setBookingCourtNum(e.target.value)}
                    min="1"
                    max="50"
                    placeholder="e.g. 1"
                    className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background rounded-lg border border-border/40 outline-none focus:border-[#BFFF00]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Notes (optional)</label>
                  <input
                    type="text"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Doubles match"
                    className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background rounded-lg border border-border/40 outline-none focus:border-[#BFFF00]/50"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!bookingDate || !bookingStartTime || !bookingEndTime) {
                    toast.error("Please fill in date, start time, and end time");
                    return;
                  }
                  const startTime = new Date(`${bookingDate}T${bookingStartTime}`);
                  const endTime = new Date(`${bookingDate}T${bookingEndTime}`);
                  if (endTime <= startTime) {
                    toast.error("End time must be after start time");
                    return;
                  }
                  createBookingMutation.mutate({
                    courtId: selectedCourtId!,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    courtNumber: bookingCourtNum ? parseInt(bookingCourtNum) : undefined,
                    notes: bookingNotes || undefined,
                  });
                }}
                disabled={createBookingMutation.isPending}
                className="w-full h-8 text-xs bg-[#BFFF00] text-black hover:bg-[#BFFF00]/80 font-semibold"
              >
                {createBookingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Booking"}
              </Button>
            </div>
          )}

          {/* Upcoming Bookings List */}
          {bookings.length > 0 ? (
            <div className="space-y-2">
              {bookings.slice(0, 5).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div>
                    <p className="text-xs font-medium">
                      {new Date(b.startTime).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })} –{" "}
                      {new Date(b.endTime).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(b.startTime).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                      {b.courtNumber ? ` · Court ${b.courtNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{b.userName || "Reserved"}</span>
                    {b.isOwn && (
                      <button
                        onClick={() => cancelBookingMutation.mutate({ bookingId: b.id })}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !showBookingForm && (
            <p className="text-xs text-muted-foreground text-center py-2">No upcoming bookings</p>
          )}
        </div>
      </div>
    </div>
  );
}
