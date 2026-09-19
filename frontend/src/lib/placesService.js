/**
 * placesService.js
 *
 * Google Places integration using the NEW google.maps.places.Place class
 * and Place.searchNearby() static method (Places API (New), stable 'weekly' channel).
 *
 * Per claude.md: "NEVER call the Places REST API directly from fetch/axios in the
 * browser." This file uses the Maps JavaScript API only.
 *
 * NOTE: place.isOpen() requires the beta channel and is NOT used here.
 * Open/closed status is computed from regularOpeningHours.periods directly,
 * which IS available on the stable weekly channel.
 *
 * Exports:
 *   findNearbyCare(lat, lng)     → up to 10 general healthcare facilities
 *   findEmergencyCare(lat, lng)  → up to 5 emergency/hospital facilities
 */

import { Loader } from '@googlemaps/js-api-loader';
import { adaptPlace } from './placesAdapter';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ── Loader singleton — injects the Maps JS script only once ──────────────────
const loader = new Loader({
  apiKey: API_KEY,
  version: 'weekly',   // stable channel — beta would enable isOpen() but is too risky
});

let _placesLib = null;

async function getPlacesLib() {
  if (_placesLib) return _placesLib;
  await loader.load();
  _placesLib = await google.maps.importLibrary('places');
  return _placesLib;
}

// ── Fields requested from the API ────────────────────────────────────────────
// Minimal set to control billing. utcOffsetMinutes is needed to convert the
// periods (which are in the place's local time) to the correct current offset.
const FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'regularOpeningHours',
  'utcOffsetMinutes',
];

// ── computeIsOpenNow ──────────────────────────────────────────────────────────
/**
 * Determines whether a place is currently open by walking the periods array
 * from regularOpeningHours. Does NOT use place.isOpen() (requires beta channel).
 *
 * Period structure (from official Place class reference):
 *   OpeningHoursPeriod {
 *     open:  OpeningHoursPoint { day: 0-6, hour: 0-23, minute: 0-59 }
 *     close: OpeningHoursPoint | undefined   ← undefined = open 24 hours
 *   }
 *   day 0 = Sunday, 1 = Monday … 6 = Saturday
 *
 * @param {google.maps.places.OpeningHours | null | undefined} regularOpeningHours
 * @param {number | null | undefined} utcOffsetMinutes  — place's UTC offset
 * @returns {boolean | null}  true=open, false=closed, null=unknown
 */
export function computeIsOpenNow(regularOpeningHours, utcOffsetMinutes) {
  if (!regularOpeningHours || !Array.isArray(regularOpeningHours.periods)) {
    return null;
  }
  if (utcOffsetMinutes == null) {
    return null;  // can't determine local time without the offset
  }

  // Current time expressed in the place's local timezone.
  // We derive this by taking UTC epoch and adding the place's UTC offset.
  const nowUtcMs = Date.now();
  const placeLocalMs = nowUtcMs + utcOffsetMinutes * 60_000;
  const placeLocal = new Date(placeLocalMs);

  // getUTC* on a date shifted by offset gives us the place's "local" wall-clock values
  const nowDay    = placeLocal.getUTCDay();    // 0=Sun … 6=Sat
  const nowHour   = placeLocal.getUTCHours();  // 0-23
  const nowMinute = placeLocal.getUTCMinutes();// 0-59
  const nowMins   = nowDay * 24 * 60 + nowHour * 60 + nowMinute; // minutes since Sun 00:00

  const WEEK_MINS = 7 * 24 * 60;

  for (const period of regularOpeningHours.periods) {
    if (!period.open) continue;

    // No close point → open 24 hours all week
    if (!period.close) {
      return true;
    }

    const openMins =
      period.open.day * 24 * 60 +
      period.open.hour * 60 +
      period.open.minute;

    const closeMins =
      period.close.day * 24 * 60 +
      period.close.hour * 60 +
      period.close.minute;

    if (closeMins > openMins) {
      // Normal same-day or multi-day span not crossing week boundary
      // e.g. Mon 08:00 → Mon 22:00, or Mon 22:00 → Tue 06:00
      if (nowMins >= openMins && nowMins < closeMins) {
        return true;
      }
    } else {
      // Span wraps past Saturday midnight back to Sunday
      // e.g. Sat 20:00 → Sun 02:00
      if (nowMins >= openMins || nowMins < closeMins) {
        return true;
      }
    }
  }

  // No matching period found — currently closed
  return false;
}

// ── Adapt a list of Place instances ──────────────────────────────────────────
/**
 * Computes open_now synchronously using computeIsOpenNow(), adapts each place,
 * filters nulls, sorts by distance ascending.
 */
function adaptPlaceList(places, originLat, originLng) {
  return places
    .map((place) => {
      const open_now = computeIsOpenNow(
        place.regularOpeningHours,
        place.utcOffsetMinutes
      );
      return adaptPlace(place, originLat, originLng, open_now);
    })
    .filter(Boolean)
    .sort((a, b) => a.distance_km - b.distance_km);
}

// ── findNearbyCare ────────────────────────────────────────────────────────────
/**
 * Searches for general healthcare facilities near the given coordinates.
 * Module 2 §1A: limit 10, run through adapter, sorted by distance.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Array<{id, name, address, latitude, longitude, open_now, distance_km}>>}
 */
export async function findNearbyCare(lat, lng) {
  const { Place } = await getPlacesLib();

  const request = {
    fields: FIELDS,
    locationRestriction: {
      center: { lat, lng },
      radius: 5000, // 5 km — Module 2 §1A
    },
    // Valid Table A types — Health and Wellness category
    // ('clinic' and 'health' are Table B only and cause INVALID_ARGUMENT)
    includedPrimaryTypes: ['hospital', 'doctor', 'medical_clinic', 'medical_center', 'pharmacy'],
    maxResultCount: 10, // cost control — Module 2 §1A
  };

  const { places } = await Place.searchNearby(request);
  return adaptPlaceList(places, lat, lng);
}

// ── findEmergencyCare ─────────────────────────────────────────────────────────
/**
 * Searches for emergency-capable hospitals near the given coordinates.
 * Module 2 §1B: limit 5, wider radius, sorted by distance.
 *
 * Per Module 2 §1B Unblocking Rule: callers must NOT await this before showing
 * the emergency alert banner. Show the alert immediately, populate facilities
 * when this promise resolves.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Array<{id, name, address, latitude, longitude, open_now, distance_km}>>}
 */
export async function findEmergencyCare(lat, lng) {
  const { Place } = await getPlacesLib();

  const request = {
    fields: FIELDS,
    locationRestriction: {
      center: { lat, lng },
      radius: 10000, // 10 km — Module 2 §1B
    },
    includedPrimaryTypes: ['hospital', 'general_hospital'],
    maxResultCount: 5, // cost control — Module 2 §1B
  };

  const { places } = await Place.searchNearby(request);
  return adaptPlaceList(places, lat, lng);
}
