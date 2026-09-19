/**
 * placesAdapter.js
 *
 * STRICT adapter layer between Google Places API results and UI components.
 * NO UI component may consume raw Google Places field names.
 * All Places results MUST pass through adaptPlace() before reaching the UI.
 *
 * Supports the NEW google.maps.places.Place class (Places API New).
 * Field mapping from Place class → internal contract:
 *   place.id             → id
 *   place.displayName    → name
 *   place.formattedAddress → address
 *   place.location       → { latitude, longitude }  (LatLng object, use .lat()/.lng())
 *   place.regularOpeningHours?.isOpen() → open_now  (boolean | null)
 *   Haversine formula    → distance_km
 *
 * Internal contract (the only shape UI components are allowed to consume):
 * {
 *   id:          string          — Google place id
 *   name:        string          — display name
 *   address:     string          — formatted address
 *   latitude:    number
 *   longitude:   number
 *   open_now:    boolean | null  — null when opening hours data unavailable
 *   distance_km: number          — Haversine straight-line from origin
 * }
 */

// ── Haversine formula ─────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// ── Adapter for new Place class ───────────────────────────────────────────────

/**
 * Transforms a single google.maps.places.Place instance (from Place.searchNearby)
 * into the internal facility contract.
 * Returns null if the result lacks the minimum required fields (id + location).
 *
 * @param {google.maps.places.Place} place  — Place instance from searchNearby
 * @param {number} originLat
 * @param {number} originLng
 * @param {boolean | null} open_now  — pre-resolved from await place.isOpen()
 *   Pass null when hours data is unavailable or the call failed.
 *   Callers MUST resolve place.isOpen() before calling adaptPlace() because
 *   isOpen() is async and cannot be awaited inside Array.map().
 * @returns {{ id, name, address, latitude, longitude, open_now, distance_km } | null}
 */
export function adaptPlace(place, originLat, originLng, open_now = null) {
  if (!place || !place.id || !place.location) {
    return null;
  }

  // place.location is a google.maps.LatLng — always call as methods
  const lat = place.location.lat();
  const lng = place.location.lng();

  const name = place.displayName || 'Unknown Facility';
  const address = place.formattedAddress || '';
  const distance_km = haversineKm(originLat, originLng, lat, lng);

  return {
    id: place.id,
    name,
    address,
    latitude: lat,
    longitude: lng,
    open_now: typeof open_now === 'boolean' ? open_now : null,
    distance_km,
  };
}

/**
 * NOTE: Array-level adaptation with async isOpen() resolution is handled
 * in placesService.js via resolvePlaces(). This function is intentionally
 * kept as a single-item transformer that receives a pre-resolved open_now.
 */
