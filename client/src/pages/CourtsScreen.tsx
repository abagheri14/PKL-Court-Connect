import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Search, Star, Users, Clock, Navigation, Loader2, Heart, List, Map as MapIcon, Plus, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect } from "react";
import { MapView, mapboxgl } from "@/components/Map";
import { QueryError } from "@/components/QueryError";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "@/hooks/useGeolocation";

const filters = ["All", "Free", "Paid", "Indoor", "Outdoor"];

export default function CourtsScreen() {
  const { selectCourt, navigate, goBack, user } = useApp();
  const { t } = useTranslation();
  const geo = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });
  const courtsQuery = trpc.courts.list.useQuery();
  const courts: any[] = courtsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("court-favorites") || "[]") as number[]); } catch { return new Set(); }
  });
  const [showMap, setShowMap] = useState(true);
  const [fullscreenMap, setFullscreenMap] = useState(false);

  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const toggleFavorite = (courtId: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(courtId)) next.delete(courtId); else next.add(courtId);
      localStorage.setItem("court-favorites", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filtered = courts.filter((c: any) => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "All") return matchesSearch;
    if (activeFilter === "Free") return matchesSearch && c.isFree;
    if (activeFilter === "Paid") return matchesSearch && !c.isFree;
    if (activeFilter === "Indoor") return matchesSearch && (c.courtType === "Indoor" || c.courtType === "indoor" || c.courtType === "Both" || c.courtType === "both");
    if (activeFilter === "Outdoor") return matchesSearch && (c.courtType === "Outdoor" || c.courtType === "outdoor" || c.courtType === "Both" || c.courtType === "both");
    return matchesSearch;
  }).sort((a: any, b: any) => {
    // Favorites first
    const aFav = favorites.has(a.id) ? 0 : 1;
    const bFav = favorites.has(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return (a.distance ?? 999) - (b.distance ?? 999);
  });

  const handleCourtTap = (court: any) => {
    selectCourt(court.id);
  };

  // Build popup DOM safely (no innerHTML — prevents XSS from user-submitted court data)
  const buildCourtPopup = useCallback((court: any): HTMLElement => {
    const container = document.createElement("div");
    container.style.cssText = "padding:10px;font-family:inherit";

    const title = document.createElement("p");
    title.style.cssText = "font-weight:800;font-size:14px;margin:0 0 4px;color:#fff";
    title.textContent = court.name;
    container.appendChild(title);

    if (court.address) {
      const addr = document.createElement("p");
      addr.style.cssText = "font-size:11px;color:#999;margin:0 0 8px";
      addr.textContent = court.address;
      container.appendChild(addr);
    }

    const meta = document.createElement("div");
    meta.style.cssText = "display:flex;gap:10px;font-size:10px;color:#aaa;margin-bottom:10px";
    if (court.averageRating) { const s = document.createElement("span"); s.textContent = `★ ${Number(court.averageRating).toFixed(1)}`; meta.appendChild(s); }
    if (court.numCourts) { const s = document.createElement("span"); s.textContent = t("court.courtCount", { count: court.numCourts }); meta.appendChild(s); }
    if (court.courtType) { const s = document.createElement("span"); s.style.textTransform = "capitalize"; s.textContent = String(court.courtType); meta.appendChild(s); }
    if (court.isFree) { const s = document.createElement("span"); s.style.color = "#FFD700"; s.textContent = t("common.free"); meta.appendChild(s); }
    if (meta.children.length) container.appendChild(meta);

    const btn = document.createElement("button");
    btn.style.cssText = "width:100%;padding:8px;border-radius:10px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;font-weight:700;font-size:12px;border:none;cursor:pointer";
    btn.textContent = t("courtsScreen.viewCourtDetails");
    btn.addEventListener("click", () => handleCourtTap(court));
    container.appendChild(btn);

    return container;
  }, [t]);

  // Add/update markers on existing map instance
  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    courts.forEach(court => {
      if (court.latitude && court.longitude) {
        const lat = Number(court.latitude);
        const lng = Number(court.longitude);
        const isFav = favorites.has(court.id);

        const el = document.createElement("div");
        el.className = "court-marker-pin";
        el.style.cssText = `width:24px;height:24px;border-radius:50%;border:3px solid white;cursor:pointer;transition:transform 0.2s;transform-origin:center center;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:${isFav ? '#ef4444' : '#FFD700'};pointer-events:auto;position:relative;z-index:1`;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; el.style.zIndex = "10"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; el.style.zIndex = "1"; });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);

        // Use the custom element directly for click since Marker's getElement may wrap
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (popupRef.current) popupRef.current.remove();

          const popup = new mapboxgl.Popup({ offset: 18, closeOnClick: true, maxWidth: "260px", closeButton: true })
            .setLngLat([lng, lat])
            .setDOMContent(buildCourtPopup(court))
            .addTo(map);

          popupRef.current = popup;
        });

        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        hasBounds = true;
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1200 });
    }
  }, [courts, favorites, buildCourtPopup]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    updateMarkers();
  }, [updateMarkers]);

  // Re-add markers when courts data or favorites change (fixes race condition)
  useEffect(() => {
    if (mapRef.current && courts.length > 0) {
      updateMarkers();
    }
  }, [courts, favorites, updateMarkers]);

  // Resize map when toggling fullscreen
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.resize();
    }
  }, [fullscreenMap]);

  return (
    <div className={cn("min-h-screen", fullscreenMap ? "h-screen flex flex-col" : "pb-24")}>
      {/* Header */}
      <div className="relative overflow-hidden flex-shrink-0">
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-cyan-500/6 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => fullscreenMap ? setFullscreenMap(false) : goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{fullscreenMap ? t("courtsScreen.courtMap") : t("courtsScreen.findCourts")}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => navigate("submitCourt")}
              className="p-2 rounded-xl glass hover:scale-105 transition-transform"
              title={t("courtsScreen.submitCourt")}
            >
              <Plus size={16} />
            </button>
            {showMap && (
              <button
                onClick={() => setFullscreenMap(!fullscreenMap)}
                className="p-2 rounded-xl glass hover:scale-105 transition-transform"
                title={fullscreenMap ? t("courtsScreen.exitFullscreen") : t("courtsScreen.fullscreenMap")}
              >
                {fullscreenMap ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button
              onClick={() => { setShowMap(!showMap); setFullscreenMap(false); }}
              className="p-2 rounded-xl glass hover:scale-105 transition-transform"
            >
              {showMap ? <List size={16} /> : <MapIcon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Search — hidden in fullscreen map mode */}
      {!fullscreenMap && (
      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("courtsScreen.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 rounded-xl"
          />
        </div>
      </div>
      )}

      {/* Filters — hidden in fullscreen map mode */}
      {!fullscreenMap && (
      <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        {filters.map(f => {
          const count = f === "All" ? courts.length : courts.filter((c: any) => {
            if (f === "Free") return c.isFree;
            if (f === "Paid") return !c.isFree;
            if (f === "Indoor") return (c.courtType === "Indoor" || c.courtType === "indoor" || c.courtType === "Both" || c.courtType === "both");
            if (f === "Outdoor") return (c.courtType === "Outdoor" || c.courtType === "outdoor" || c.courtType === "Both" || c.courtType === "both");
            return true;
          }).length;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all", activeFilter === f ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20")}
            >
              {t(f)} ({count})
            </button>
          );
        })}
      </div>
      )}

      {/* Map View */}
      {courtsQuery.isError && !courts.length ? (
        <div className="px-5"><QueryError message={t("courtsScreen.failedToLoad")} onRetry={() => courtsQuery.refetch()} /></div>
      ) : (
      <>
      {showMap && (
        <div className={cn(fullscreenMap ? "flex-1 relative" : "px-5 pb-4")}>
          <div className={cn(fullscreenMap ? "w-full h-full absolute inset-0" : "card-elevated rounded-xl h-56 relative overflow-hidden")}>
            <MapView
              className={cn("w-full h-full", !fullscreenMap && "rounded-2xl")}
              initialCenter={{ lat: geo.lat, lng: geo.lng }}
              initialZoom={10}
              flyToUser
              onMapReady={handleMapReady}
            />
          </div>
          {/* Floating court count badge — fullscreen only */}
          {fullscreenMap && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
              <div className="card-elevated rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
                <MapPin size={14} className="text-secondary" />
                <span className="text-xs font-semibold">{t("courtsScreen.courtsOnMap", { count: courts.filter((c: any) => c.latitude && c.longitude).length })}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Court List — hidden in fullscreen map mode */}
      {!fullscreenMap && (
      <div className="px-5 space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
          {t("courtsScreen.courtsNearby", { count: filtered.length })}
        </h2>
        {filtered.map(court => (
          <div
            key={court.id}
            role="button"
            tabIndex={0}
            onClick={() => handleCourtTap(court)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCourtTap(court); }}
            className="w-full card-elevated rounded-xl p-4 text-left hover:border-secondary/40 transition-all cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm">{court.name}</h3>
                  {favorites.has(court.id) && <Heart size={10} className="text-red-400 fill-red-400" />}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <MapPin size={10} className="text-secondary" />
                  <span className="truncate">{court.address || court.city || "Location available on map"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-secondary text-xs">
                  <Star size={12} fill="currentColor" />
                  <span className="font-medium">{(court.averageRating ?? 0).toFixed(1)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(court.id); }}
                  className="p-1 rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <Heart size={14} className={favorites.has(court.id) ? "text-red-400 fill-red-400" : "text-muted-foreground/40"} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 text-[10px] text-muted-foreground">
              {court.distance != null && (
                <div className="flex items-center gap-1">
                  <Navigation size={10} className="text-primary" />
                  <span>{court.distance} mi</span>
                </div>
              )}
              {court.numCourts != null && (
                <div className="flex items-center gap-1">
                  <Users size={10} />
                  <span>{court.numCourts} {t("court.courts")}</span>
                </div>
              )}
              {court.courtType && (
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span className="capitalize">{court.courtType}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {(() => {
                let amenitiesList: string[] = [];
                try {
                  if (Array.isArray(court.amenities)) amenitiesList = court.amenities;
                  else if (typeof court.amenities === "string") amenitiesList = JSON.parse(court.amenities);
                } catch {
                  amenitiesList = typeof court.amenities === "string" ? court.amenities.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                }
                return amenitiesList.slice(0, 3).map((a: string) => (
                  <span key={a} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px]">
                    {a}
                  </span>
                ));
              })()}
              {!court.isFree && (
                <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px]">
                  {court.costInfo}
                </span>
              )}
              {court.isFree && (
                <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px]">
                  {t("common.free")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
      </>
      )}
    </div>
  );
}
