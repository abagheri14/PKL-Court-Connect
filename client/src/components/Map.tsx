/**
 * MAPBOX GL JS FRONTEND INTEGRATION
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 * import mapboxgl from "mapbox-gl";
 *
 * const mapRef = useRef<mapboxgl.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => { mapRef.current = map; }}
 * />
 *
 * // Add markers:
 * new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
 *
 * // Fit bounds:
 * const bounds = new mapboxgl.LngLatBounds();
 * bounds.extend([lng, lat]);
 * map.fitBounds(bounds, { padding: 50 });
 */

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const hasToken = Boolean(mapboxgl.accessToken);

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: mapboxgl.Map) => void;
  /** When true, flies to the user's GPS location after map loads and shows a blue dot */
  flyToUser?: boolean;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  flyToUser = false,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!hasToken) {
      setError("Map is not available. Mapbox token is not configured.");
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [initialCenter.lng, initialCenter.lat],
        zoom: initialZoom,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        // Resize after layout settles (fixes 0-height in flex containers)
        map.current?.resize();

        // Fly to user's real location — runs after map is ready so no race condition
        if (flyToUser && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!map.current) return;
              const { latitude, longitude } = pos.coords;
              map.current.flyTo({ center: [longitude, latitude], zoom: 15, duration: 1400 });
              // Blue pulsing dot for user location
              const el = document.createElement("div");
              el.style.cssText = [
                "width:18px", "height:18px", "border-radius:50%",
                "background:#3b82f6", "border:2.5px solid #fff",
                "box-shadow:0 0 0 6px rgba(59,130,246,0.25)",
                "cursor:default",
              ].join(";");
              new mapboxgl.Marker({ element: el, anchor: "center" })
                .setLngLat([longitude, latitude])
                .addTo(map.current);
            },
            () => {}, // permission denied — stay at initialCenter
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }

        if (onMapReady && map.current) {
          onMapReady(map.current);
        }
      });

      // rAF + setTimeout double-fallback: ensures resize after flex/absolute layout settles
      const m = map.current;
      requestAnimationFrame(() => m?.resize());
      setTimeout(() => m?.resize(), 100);
    } catch {
      setError("Map could not be loaded. Your browser may not support WebGL.");
    }

    // ResizeObserver to handle dynamic container resizing
    const container = mapContainer.current;
    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className={cn("w-full h-[500px] flex items-center justify-center bg-muted/10 rounded-xl", className)}>
        <p className="text-sm text-muted-foreground px-4 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}

export { mapboxgl };
