import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { MapView, mapboxgl } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Send, Loader2, Sun, Moon, Lightbulb, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "@/hooks/useGeolocation";

const courtTypes = ["outdoor", "indoor", "both"] as const;
const surfaceTypes = ["Concrete", "Asphalt", "Portable", "Gym Floor", "Other"];

export default function SubmitCourtScreen() {
  const { goBack, user } = useApp();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const geo = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });

  const [step, setStep] = useState<"pin" | "form">("pin");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [courtType, setCourtType] = useState<"indoor" | "outdoor" | "both">("outdoor");
  const [numCourts, setNumCourts] = useState(1);
  const [surfaceType, setSurfaceType] = useState("");
  const [lighting, setLighting] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [costInfo, setCostInfo] = useState("");
  const [amenities, setAmenities] = useState("");
  const [notes, setNotes] = useState("");

  const submitMutation = trpc.courts.submit.useMutation({
    onSuccess: () => {
      toast.success(t("submitCourt.submitted"));
      utils.courts.mySubmissions.invalidate();
      goBack();
    },
    onError: (err) => toast.error(err.message),
  });

  // Reverse geocode pin to auto-fill address, city, state
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const token = mapboxgl.accessToken;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,place,region&limit=1`);
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature) return;
      // Use place_name as full address
      if (feature.place_name && !address) setAddress(feature.place_name);
      // Extract city and state from context
      const ctx = feature.context ?? [];
      for (const c of ctx) {
        if (c.id?.startsWith("place") && !city) setCity(c.text);
        if (c.id?.startsWith("region") && !state) setState(c.short_code?.replace("US-", "") || c.text);
      }
      // Fallback: if feature itself is a place (city)
      if (!city && feature.place_type?.includes("place")) setCity(feature.text);
      if (!city && feature.place_type?.includes("region")) setState(feature.text);
    } catch { /* silently ignore geocoding failures */ }
  }, [address, city, state]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;

    // On click, place/move the pin
    map.on("click", (e) => {
      const lngLat = e.lngLat;
      setPin({ lat: lngLat.lat, lng: lngLat.lng });
      reverseGeocode(lngLat.lat, lngLat.lng);

      if (markerRef.current) {
        markerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#f59e0b", draggable: true })
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          setPin({ lat: pos.lat, lng: pos.lng });
          reverseGeocode(pos.lat, pos.lng);
        });
      }
    });
  }, [reverseGeocode]);

  const handleSubmit = () => {
    if (!pin) return;
    if (!name.trim()) { toast.error(t("submitCourt.nameRequired")); return; }
    submitMutation.mutate({
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: pin.lat,
      longitude: pin.lng,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      courtType,
      numCourts,
      surfaceType: surfaceType || undefined,
      lighting,
      isFree,
      costInfo: !isFree ? costInfo.trim() || undefined : undefined,
      amenities: amenities.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="h-screen flex flex-col pb-[68px]">
      {/* Header */}
      <div className="relative overflow-hidden flex-shrink-0">
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => step === "form" ? setStep("pin") : goBack()} aria-label="Go back" className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{t("submitCourt.title")}</h1>
            <p className="text-[10px] text-muted-foreground">
              {step === "pin" ? t("submitCourt.tapMapPin") : t("submitCourt.fillDetails")}
            </p>
          </div>
        </div>
      </div>

      {step === "pin" && (
        <>
          {/* Full map */}
          <div className="flex-1 relative">
            <MapView
              className="w-full h-full absolute inset-0"
              initialCenter={{ lat: geo.lat, lng: geo.lng }}
              initialZoom={11}
              flyToUser
              onMapReady={handleMapReady}
            />
            {/* Instruction overlay */}
            {!pin && (
              <div className="absolute top-4 left-4 right-4 z-10">
                <div className="card-elevated rounded-xl px-4 py-3 flex items-center gap-2">
                  <MapPin size={16} className="text-secondary flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{t("submitCourt.tapAnywhere")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Continue button */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background">
            <Button
              onClick={() => setStep("form")}
              disabled={!pin}
              className="w-full py-5 rounded-2xl bg-secondary text-background font-semibold"
            >
              <MapPin size={16} className="mr-2" /> {t("submitCourt.confirmLocation")}
            </Button>
          </div>
        </>
      )}

      {step === "form" && (
        <div className="flex-1 overflow-y-auto px-5 pb-32">
          {/* Pin summary */}
          <div className="card-elevated rounded-xl p-3 mb-4 flex items-center gap-2">
            <MapPin size={14} className="text-secondary" />
            <span className="text-xs text-muted-foreground">
              {pin?.lat.toFixed(5)}, {pin?.lng.toFixed(5)}
            </span>
            <button onClick={() => setStep("pin")} className="ml-auto text-xs text-secondary font-medium">{t("common.change")}</button>
          </div>

          {/* Court Name */}
          <label className="block mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.courtName")} *</span>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("submitCourt.courtNamePlaceholder")} className="bg-background/50" />
          </label>

          {/* Address */}
          <label className="block mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.address")}</span>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder={t("submitCourt.streetAddress")} className="bg-background/50" />
          </label>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.city")}</span>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder={t("submitCourt.city")} className="bg-background/50" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.stateProvince")}</span>
              <Input value={state} onChange={e => setState(e.target.value)} placeholder={t("submitCourt.state")} className="bg-background/50" />
            </label>
          </div>

          {/* Court Type */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("submitCourt.courtType")}</span>
            <div className="flex gap-2">
              {courtTypes.map(ct => (
                <button
                  key={ct}
                  onClick={() => setCourtType(ct)}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1",
                    courtType === ct ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
                  )}
                >
                  {ct === "outdoor" ? <Sun size={12} /> : ct === "indoor" ? <Moon size={12} /> : null}
                  {ct.charAt(0).toUpperCase() + ct.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Number of Courts */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("submitCourt.numberOfCourts")}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setNumCourts(Math.max(1, numCourts - 1))} className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center font-bold text-lg">-</button>
              <span className="text-lg font-bold w-8 text-center">{numCourts}</span>
              <button onClick={() => setNumCourts(Math.min(50, numCourts + 1))} className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center font-bold text-lg">+</button>
            </div>
          </div>

          {/* Surface Type */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("submitCourt.surfaceType")}</span>
            <div className="flex flex-wrap gap-1.5">
              {surfaceTypes.map(st => (
                <button
                  key={st}
                  onClick={() => setSurfaceType(surfaceType === st ? "" : st)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    surfaceType === st ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Lighting */}
          <button
            onClick={() => setLighting(!lighting)}
            className={cn("w-full card-elevated rounded-xl p-3 mb-3 flex items-center gap-3 transition-all",
              lighting && "border-secondary/30"
            )}
          >
            <Lightbulb size={16} className={lighting ? "text-secondary" : "text-muted-foreground"} />
            <span className="text-sm">{t("submitCourt.hasLighting")}</span>
            <div className={cn("ml-auto w-10 h-5 rounded-full transition-all", lighting ? "bg-secondary" : "bg-muted/30")}>
              <div className={cn("w-4 h-4 rounded-full bg-white mt-0.5 transition-all", lighting ? "ml-5.5" : "ml-0.5")} />
            </div>
          </button>

          {/* Free / Paid */}
          <button
            onClick={() => setIsFree(!isFree)}
            className={cn("w-full card-elevated rounded-xl p-3 mb-3 flex items-center gap-3 transition-all",
              !isFree && "border-secondary/30"
            )}
          >
            <DollarSign size={16} className={!isFree ? "text-secondary" : "text-muted-foreground"} />
            <span className="text-sm">{isFree ? t("submitCourt.freeToPlay") : t("submitCourt.paidCourt")}</span>
            <div className={cn("ml-auto w-10 h-5 rounded-full transition-all", !isFree ? "bg-secondary" : "bg-muted/30")}>
              <div className={cn("w-4 h-4 rounded-full bg-white mt-0.5 transition-all", !isFree ? "ml-5.5" : "ml-0.5")} />
            </div>
          </button>

          {!isFree && (
            <label className="block mb-3">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.costInfo")}</span>
              <Input value={costInfo} onChange={e => setCostInfo(e.target.value)} placeholder={t("submitCourt.costInfoPlaceholder")} className="bg-background/50" />
            </label>
          )}

          {/* Amenities */}
          <label className="block mb-3">
            <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.amenities")}</span>
            <Input value={amenities} onChange={e => setAmenities(e.target.value)} placeholder={t("submitCourt.amenitiesPlaceholder")} className="bg-background/50" />
          </label>

          {/* Notes */}
          <label className="block mb-4">
            <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t("submitCourt.notesForAdmin")}</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t("submitCourt.notesPlaceholder")}
              className="w-full bg-background/50 rounded-lg p-3 text-sm border border-border min-h-[60px] resize-none focus:outline-none focus:border-secondary"
              maxLength={500}
            />
          </label>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !name.trim()}
            className="w-full py-5 rounded-2xl bg-secondary text-background font-semibold"
          >
            {submitMutation.isPending ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <Send size={16} className="mr-2" />
            )}
            {t("submitCourt.submitForReview")}
          </Button>
        </div>
      )}
    </div>
  );
}
