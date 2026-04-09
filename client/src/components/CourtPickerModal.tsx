import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { MapView, mapboxgl } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, MapPin, Star, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "@/hooks/useGeolocation";

interface Court {
  id: number;
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  distance?: number;
  averageRating?: number | null;
  courtType?: string | null;
  numCourts?: number | null;
}

interface CourtPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (court: Court) => void;
  title?: string;
}

export default function CourtPickerModal({ open, onClose, onSelect, title }: CourtPickerModalProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const geo = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });
  const courtsQuery = trpc.courts.list.useQuery(undefined, { enabled: open });
  const courts = (courtsQuery.data ?? []) as Court[];
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const filtered = courts.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback((court: Court) => {
    onSelect(court);
    onClose();
  }, [onSelect, onClose]);

  // Build popup DOM safely (no innerHTML/setHTML — prevents XSS)
  const buildPopupContent = useCallback((court: Court): HTMLElement => {
    const container = document.createElement("div");
    container.style.cssText = "padding:8px;min-width:180px;font-family:inherit";

    const title = document.createElement("p");
    title.style.cssText = "font-weight:700;font-size:13px;margin:0 0 4px";
    title.textContent = court.name;
    container.appendChild(title);

    if (court.address) {
      const addr = document.createElement("p");
      addr.style.cssText = "font-size:11px;color:#999;margin:0 0 6px";
      addr.textContent = court.address;
      container.appendChild(addr);
    }

    const meta = document.createElement("div");
    meta.style.cssText = "display:flex;gap:8px;font-size:10px;color:#999;margin-bottom:8px";
    if (court.averageRating) { const s = document.createElement("span"); s.textContent = `★ ${Number(court.averageRating).toFixed(1)}`; meta.appendChild(s); }
    if (court.numCourts) { const s = document.createElement("span"); s.textContent = `${court.numCourts} courts`; meta.appendChild(s); }
    if (court.courtType) { const s = document.createElement("span"); s.textContent = String(court.courtType); meta.appendChild(s); }
    if (meta.children.length) container.appendChild(meta);

    const btn = document.createElement("button");
    btn.style.cssText = "width:100%;padding:6px;border-radius:8px;background:#FFD700;color:#000;font-weight:700;font-size:11px;border:none;cursor:pointer";
    btn.textContent = t("courtPickerModal.selectThisCourt");
    btn.addEventListener("click", () => handleSelect(court));
    container.appendChild(btn);

    return container;
  }, [handleSelect, t]);

  // Update markers whenever courts data changes (fixes race condition where map loads before courts)
  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    courts.forEach(court => {
      if (court.latitude && court.longitude) {
        const lat = Number(court.latitude);
        const lng = Number(court.longitude);
        const el = document.createElement("div");
        el.className = "w-4 h-4 rounded-full bg-secondary border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform";

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        marker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();
          if (popupRef.current) popupRef.current.remove();

          const popup = new mapboxgl.Popup({ offset: 25, closeOnClick: true })
            .setLngLat([lng, lat])
            .setDOMContent(buildPopupContent(court))
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
  }, [courts, buildPopupContent]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    // Add markers for already-loaded courts
    updateMarkers();
  }, [updateMarkers]);

  // Re-add markers when courts data arrives or changes
  useEffect(() => {
    if (open && mapRef.current && courts.length > 0) {
      updateMarkers();
    }
  }, [courts, open, updateMarkers]);

  // Resize map when switching back to map view (it may have had display:none)
  useEffect(() => {
    if (view === "map" && mapRef.current) {
      mapRef.current.resize();
    }
  }, [view]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      mapRef.current = null;
      setSearch("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-slide-up">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={onClose} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
          <X size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight">{title || t("Select a Court")}</h2>
          <p className="text-[10px] text-muted-foreground">
            {courtsQuery.isLoading ? t("Loading...") : `${courts.length} ${t("courts available")}`}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView("map")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === "map" ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
            )}>{t("courtPickerModal.map")}</button>
          <button onClick={() => setView("list")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === "list" ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
            )}>{t("courtPickerModal.list")}</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-5 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Search courts...")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 rounded-xl"
          />
        </div>
      </div>

      {/* Map View — hidden via CSS when list is active (preserves map instance) */}
      <div className={cn("flex-1 relative", view !== "map" && "hidden")}>
        <MapView
          className="w-full h-full absolute inset-0"
          initialCenter={{ lat: geo.lat, lng: geo.lng }}
          initialZoom={11}
          flyToUser
          onMapReady={handleMapReady}
        />
      </div>

      {/* List View — hidden via CSS when map is active */}
      <div className={cn("flex-1 overflow-y-auto px-5 pb-8", view !== "list" && "hidden")}>
          <div className="space-y-2 pt-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <MapPin size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t("No courts found")}</p>
              </div>
            ) : filtered.map(court => (
              <button
                key={court.id}
                onClick={() => handleSelect(court)}
                className="w-full card-elevated rounded-xl p-3.5 text-left hover:border-secondary/40 transition-all active:scale-[0.98]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{court.name}</h3>
                    {court.address && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <MapPin size={10} className="text-secondary flex-shrink-0" />
                        <span className="truncate">{court.address}</span>
                      </div>
                    )}
                  </div>
                  {court.averageRating ? (
                    <div className="flex items-center gap-0.5 text-secondary text-xs flex-shrink-0 ml-2">
                      <Star size={12} fill="currentColor" />
                      <span className="font-medium">{Number(court.averageRating).toFixed(1)}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-1.5">
                  {court.distance != null && (
                    <div className="flex items-center gap-1">
                      <Navigation size={10} className="text-primary" />
                      <span>{court.distance} mi</span>
                    </div>
                  )}
                  {court.numCourts && <span>{court.numCourts} courts</span>}
                  {court.courtType && <span className="capitalize">{court.courtType}</span>}
                </div>
              </button>
            ))}
          </div>
      </div>
    </div>
  );
}
