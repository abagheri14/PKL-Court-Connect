import { useState, useEffect } from "react";

interface GeoState {
  lat: number;
  lng: number;
  loading: boolean;
  error: string | null;
}

// Geometric center of contiguous US as neutral fallback
const FALLBACK_LAT = 39.8283;
const FALLBACK_LNG = -98.5795;

interface UseGeolocationOptions {
  /** User's stored latitude from DB (preferred fallback) */
  fallbackLat?: number | null;
  /** User's stored longitude from DB (preferred fallback) */
  fallbackLng?: number | null;
}

export function useGeolocation(options?: UseGeolocationOptions) {
  const defaultLat = options?.fallbackLat ?? FALLBACK_LAT;
  const defaultLng = options?.fallbackLng ?? FALLBACK_LNG;

  const [state, setState] = useState<GeoState>({
    lat: defaultLat,
    lng: defaultLng,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: "Geolocation not supported" }));
      return;
    }

    let cancelled = false;

    const onSuccess = (pos: GeolocationPosition) => {
      if (cancelled) return;
      setState({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        loading: false,
        error: null,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      // Safari sometimes fails with enableHighAccuracy — retry without it
      if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryErr) => {
            if (cancelled) return;
            setState(s => ({ ...s, loading: false, error: retryErr.message }));
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
        );
      } else {
        setState(s => ({ ...s, loading: false, error: err.message }));
      }
    };

    // Try high accuracy first (works well on Android/Chrome), Safari may need fallback
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      onError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );

    return () => { cancelled = true; };
  }, []);

  return state;
}
