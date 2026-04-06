import { useState, useCallback, useRef, useEffect } from "react";
import { MapPin, Navigation, Search, X, Building2, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MapView, mapboxgl } from "@/components/Map";
import CourtPickerModal from "@/components/CourtPickerModal";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

export interface LocationData {
  courtId?: number;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
}

interface LocationPickerSectionProps {
  value: LocationData;
  onChange: (data: LocationData) => void;
  label?: string;
  /** Accent color for selected state (default: secondary) */
  accentColor?: string;
}

type LocationMode = "none" | "court" | "custom";

export default function LocationPickerSection({ value, onChange, label, accentColor }: LocationPickerSectionProps) {
  const { user } = useApp();
  const { t } = useTranslation();
  const geo = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });

  const [mode, setMode] = useState<LocationMode>(
    value.courtId ? "court" : (value.locationLat || value.locationName) ? "custom" : "none"
  );
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [showCustomMap, setShowCustomMap] = useState(false);
  const [customAddress, setCustomAddress] = useState(value.locationName || "");
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(
    value.locationLat && value.locationLng ? { lat: value.locationLat, lng: value.locationLng } : null
  );
  const [courtDisplay, setCourtDisplay] = useState<{ name: string; address?: string } | null>(
    value.courtId && value.locationName ? { name: value.locationName } : null
  );

  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const handleSelectCourt = useCallback((court: any) => {
    const lat = typeof court.latitude === "string" ? parseFloat(court.latitude) : court.latitude;
    const lng = typeof court.longitude === "string" ? parseFloat(court.longitude) : court.longitude;
    setMode("court");
    setCourtDisplay({ name: court.name, address: court.address });
    onChange({
      courtId: court.id,
      locationLat: lat || undefined,
      locationLng: lng || undefined,
      locationName: court.name,
    });
  }, [onChange]);

  const handleSwitchToCustom = useCallback(() => {
    setMode("custom");
    setCourtDisplay(null);
    onChange({ locationName: customAddress || undefined, locationLat: customPin?.lat, locationLng: customPin?.lng });
  }, [customAddress, customPin, onChange]);

  const handleClear = useCallback(() => {
    setMode("none");
    setCourtDisplay(null);
    setCustomAddress("");
    setCustomPin(null);
    onChange({});
  }, [onChange]);

  // Reverse geocode a pin to get an address
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const token = mapboxgl.accessToken;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,place&limit=1`);
      const data = await res.json();
      const feature = data?.features?.[0];
      if (feature?.place_name) {
        setCustomAddress(feature.place_name);
        return feature.place_name;
      }
    } catch { /* silently ignore */ }
    return null;
  }, []);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;

    // Place existing pin if any
    if (customPin) {
      markerRef.current = new mapboxgl.Marker({ color: "#BFFF00", draggable: true })
        .setLngLat([customPin.lng, customPin.lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLngLat();
        const newPin = { lat: pos.lat, lng: pos.lng };
        setCustomPin(newPin);
        reverseGeocode(pos.lat, pos.lng).then(addr => {
          const name = addr || customAddress;
          onChange({ locationLat: newPin.lat, locationLng: newPin.lng, locationName: name || undefined });
        });
      });
    }

    map.on("click", (e) => {
      const lngLat = e.lngLat;
      const newPin = { lat: lngLat.lat, lng: lngLat.lng };
      setCustomPin(newPin);

      if (markerRef.current) {
        markerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#BFFF00", draggable: true })
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          const p = { lat: pos.lat, lng: pos.lng };
          setCustomPin(p);
          reverseGeocode(pos.lat, pos.lng).then(addr => {
            const name = addr || customAddress;
            onChange({ locationLat: p.lat, locationLng: p.lng, locationName: name || undefined });
          });
        });
      }

      reverseGeocode(lngLat.lat, lngLat.lng).then(addr => {
        const name = addr || customAddress;
        onChange({ locationLat: newPin.lat, locationLng: newPin.lng, locationName: name || undefined });
      });
    });
  }, [customPin, customAddress, reverseGeocode, onChange]);

  // Update parent when address changes (no pin)
  const handleAddressChange = useCallback((addr: string) => {
    setCustomAddress(addr);
    onChange({
      locationLat: customPin?.lat,
      locationLng: customPin?.lng,
      locationName: addr || undefined,
    });
  }, [customPin, onChange]);

  const accent = accentColor || "var(--color-secondary)";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MapPin size={14} style={{ color: accent }} /> {label || "Location"}
      </h3>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode("court"); setShowCourtPicker(true); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all",
            mode === "court" ? "border-secondary bg-secondary/10 text-secondary" : "border-border hover:border-secondary/30"
          )}
        >
          <Building2 size={14} /> Select Court
        </button>
        <button
          onClick={handleSwitchToCustom}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all",
            mode === "custom" ? "border-secondary bg-secondary/10 text-secondary" : "border-border hover:border-secondary/30"
          )}
        >
          <MapPinned size={14} /> Custom Location
        </button>
      </div>

      {/* Court selected display */}
      {mode === "court" && courtDisplay && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-secondary/40 bg-secondary/5">
          <MapPin size={14} className="text-secondary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{courtDisplay.name}</p>
            {courtDisplay.address && <p className="text-[10px] text-muted-foreground truncate">{courtDisplay.address}</p>}
          </div>
          <button onClick={() => setShowCourtPicker(true)} className="text-[10px] text-secondary font-medium">Change</button>
          <button onClick={handleClear} className="p-0.5"><X size={12} className="text-muted-foreground" /></button>
        </div>
      )}

      {/* Court picker when court mode active but nothing selected */}
      {mode === "court" && !courtDisplay && (
        <button
          onClick={() => setShowCourtPicker(true)}
          className="w-full text-left p-3 rounded-xl border border-dashed border-border hover:border-secondary/40 flex items-center gap-2 text-muted-foreground"
        >
          <Search size={14} />
          <span className="text-xs">Tap to browse courts on the map</span>
        </button>
      )}

      {/* Custom location mode */}
      {mode === "custom" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Address or Location Name</label>
            <Input
              value={customAddress}
              onChange={e => handleAddressChange(e.target.value)}
              placeholder="123 Park Ave, City, State"
              className="text-xs bg-background/50"
              maxLength={255}
            />
          </div>

          {!showCustomMap ? (
            <button
              onClick={() => setShowCustomMap(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border hover:border-secondary/40 text-xs text-muted-foreground"
            >
              <Navigation size={12} /> Drop a pin on the map (optional)
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Tap to place pin · Drag to adjust</span>
                {customPin && (
                  <span className="text-[10px] text-secondary font-mono">
                    {customPin.lat.toFixed(4)}, {customPin.lng.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="h-48 rounded-xl overflow-hidden border border-border">
                <MapView
                  className="w-full h-full"
                  initialCenter={
                    customPin
                      ? { lat: customPin.lat, lng: customPin.lng }
                      : geo.lat && geo.lng
                        ? { lat: geo.lat, lng: geo.lng }
                        : undefined
                  }
                  initialZoom={14}
                  onMapReady={handleMapReady}
                />
              </div>
            </div>
          )}

          {value.locationName && (
            <button onClick={handleClear} className="text-[10px] text-muted-foreground hover:text-foreground">
              Clear location
            </button>
          )}
        </div>
      )}

      <CourtPickerModal
        open={showCourtPicker}
        onClose={() => setShowCourtPicker(false)}
        onSelect={handleSelectCourt}
      />
    </div>
  );
}
