import { useState, useEffect, useRef } from "react";

interface GeoState {
  lat: number;
  lng: number;
  loading: boolean;
  error: string | null;
}

// Geometric center of contiguous US as neutral fallback
const FALLBACK_LAT = 39.8283;
const FALLBACK_LNG = -98.5795;

// Minimum distance change (in degrees, ~0.001 ≈ 100m) before updating state
const MIN_CHANGE_DEG = 0.001;

interface UseGeolocationOptions {
  /** User's stored latitude from DB (preferred fallback) */
  fallbackLat?: number | null;
  /** User's stored longitude from DB (preferred fallback) */
  fallbackLng?: number | null;
  /** Enable continuous watching via watchPosition (default: true) */
  watch?: boolean;
}

export function useGeolocation(options?: UseGeolocationOptions) {
  const defaultLat = options?.fallbackLat ?? FALLBACK_LAT;
  const defaultLng = options?.fallbackLng ?? FALLBACK_LNG;
  const watch = options?.watch !== false;

  const [state, setState] = useState<GeoState>({
    lat: defaultLat,
    lng: defaultLng,
    loading: true,
    error: null,
  });

  const lastPos = useRef({ lat: defaultLat, lng: defaultLng });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: "Geolocation not supported" }));
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      // Only update state if position changed meaningfully (avoids unnecessary re-renders)
      const dLat = Math.abs(newLat - lastPos.current.lat);
      const dLng = Math.abs(newLng - lastPos.current.lng);
      if (dLat > MIN_CHANGE_DEG || dLng > MIN_CHANGE_DEG || lastPos.current.lat === defaultLat) {
        lastPos.current = { lat: newLat, lng: newLng };
        setState({ lat: newLat, lng: newLng, loading: false, error: null });
      } else {
        // Still clear loading on first success
        setState(s => s.loading ? { ...s, loading: false, error: null } : s);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      setState(s => ({ ...s, loading: false, error: err.message }));
    };

    // Always get an immediate position first
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });

    // Then watch continuously for live updates (like Tinder/dating apps)
    let watchId: number | undefined;
    if (watch) {
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000,
      });
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [watch]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
