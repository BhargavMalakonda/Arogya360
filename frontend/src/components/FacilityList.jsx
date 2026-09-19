/**
 * FacilityList.jsx
 *
 * Reusable component that renders a list of adapter-shaped facilities.
 * Consumes ONLY the internal contract from placesAdapter — never raw Places fields.
 *
 * Required props:
 *   facilities  {Array}   — adapter-shaped facility objects (or null/undefined)
 *   status      {string}  — one of the STATUS_* constants below
 *   onRetry     {Function} — called when the user clicks the retry button
 *
 * Handles all Module 2 §5 required UI states:
 *   loading | permission_denied | location_timeout | location_unavailable |
 *   loaded | no_results | api_error
 *
 * Fallback helpline contacts (104 / 108) are displayed in all states where
 * facility lookup failed or returned nothing — including the ESI-1 emergency
 * path from Triage.jsx, which uses this same component.
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import CardContainer from './CardContainer';
import SecondaryButton from './SecondaryButton';
import helplineContacts from '../data/helplineContacts.json';

// ── Status constants — import these wherever you set status state ─────────────
export const FACILITY_STATUS = {
  LOADING:              'loading',
  PERMISSION_DENIED:    'permission_denied',
  LOCATION_TIMEOUT:     'location_timeout',
  LOCATION_UNAVAILABLE: 'location_unavailable',
  LOADED:               'loaded',
  NO_RESULTS:           'no_results',
  API_ERROR:            'api_error',
};

// ── Helpline fallback block ────────────────────────────────────────────────────
// Shown in all failure/empty states so the user always has a way to reach help.
// Looks up userProfile.district in helplineContacts.by_district; falls back to
// helplineContacts.default if no district-specific entry exists.
// Also shown in the ESI-1 emergency path — same component, same states.
const HelplineBlock = ({ district }) => {
  const districtKey = (district ?? '').toLowerCase().trim();
  const contacts =
    (districtKey && helplineContacts.by_district?.[districtKey]) ||
    helplineContacts.default;

  return (
    <div className="mt-4 pt-3 border-t border-white/20">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        National Helplines
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={`tel:${contacts.health_helpline}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/30 border border-white/30 text-sm font-medium text-brand-indigo hover:bg-white/50 transition-colors"
          aria-label={`Call health helpline ${contacts.health_helpline}`}
        >
          {/* Phone icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
            <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 0 0 2 3.5V5c0 4.694 3.806 8.5 8.5 8.5h1.5a1.5 1.5 0 0 0 1.5-1.5v-.9a1.5 1.5 0 0 0-.927-1.382l-1.328-.532a1.5 1.5 0 0 0-1.666.44l-.255.316A5.516 5.516 0 0 1 6.82 7.17l.316-.255a1.5 1.5 0 0 0 .44-1.666l-.532-1.328A1.5 1.5 0 0 0 5.663 3H4.4A1.5 1.5 0 0 0 3.5 2Z" clipRule="evenodd" />
          </svg>
          Call {contacts.health_helpline} — Health Helpline
        </a>
        <a
          href={`tel:${contacts.ambulance}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-esi-emergency hover:bg-red-100 transition-colors"
          aria-label={`Call ambulance ${contacts.ambulance}`}
        >
          {/* Phone icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
            <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 0 0 2 3.5V5c0 4.694 3.806 8.5 8.5 8.5h1.5a1.5 1.5 0 0 0 1.5-1.5v-.9a1.5 1.5 0 0 0-.927-1.382l-1.328-.532a1.5 1.5 0 0 0-1.666.44l-.255.316A5.516 5.516 0 0 1 6.82 7.17l.316-.255a1.5 1.5 0 0 0 .44-1.666l-.532-1.328A1.5 1.5 0 0 0 5.663 3H4.4A1.5 1.5 0 0 0 3.5 2Z" clipRule="evenodd" />
          </svg>
          Call {contacts.ambulance} — Ambulance
        </a>
      </div>
    </div>
  );
};

// ── Individual facility card ──────────────────────────────────────────────────

// Returns true only when lat/lng are real, finite, non-zero coordinates.
// Hides the directions link for invalid/missing geometry (e.g. 0,0 or undefined).
function hasValidCoords(lat, lng) {
  return (
    typeof lat === 'number' && isFinite(lat) && lat !== 0 &&
    typeof lng === 'number' && isFinite(lng) && lng !== 0
  );
}

const FacilityCard = ({ facility }) => {
  const { name, address, distance_km, open_now, latitude, longitude } = facility;
  const canGetDirections = hasValidCoords(latitude, longitude);
  const mapsUrl = canGetDirections
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : null;

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/20 border border-white/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{address}</p>
        <p className="text-xs text-gray-400 mt-1">{distance_km} km away</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
        {open_now === true && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-esi-success text-white font-medium">
            Open
          </span>
        )}
        {open_now === false && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-300 text-gray-600 font-medium">
            Closed
          </span>
        )}
        {open_now === null && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/40 border border-white/30 text-gray-400 font-medium">
            Hours unknown
          </span>
        )}
        {/* Directions link — hidden when coordinates are missing or invalid */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Get directions to ${name}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-brand-indigo/50 text-brand-indigo hover:bg-brand-indigo hover:text-white transition-colors"
          >
            {/* Navigation/arrow icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0" aria-hidden="true">
              <path d="M7.47.22a.75.75 0 0 1 1.06 0l7.25 7.25a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06-1.06L13.19 9H2.75a.75.75 0 0 1 0-1.5h10.44L7.47 1.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
            Directions
          </a>
        )}
      </div>
    </div>
  );
};

// ── Main FacilityList ─────────────────────────────────────────────────────────
const FacilityList = ({ facilities, status, onRetry, title = 'Nearby Care' }) => {
  const { userProfile } = useAuth();
  const district = userProfile?.district;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === FACILITY_STATUS.LOADING) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/20 animate-pulse" />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Finding nearby facilities…
        </p>
      </CardContainer>
    );
  }

  // ── Permission Denied ──────────────────────────────────────────────────────
  // User has no location path at all — helpline is the only option.
  if (status === FACILITY_STATUS.PERMISSION_DENIED) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">{title}</h3>
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">🔒</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Location access denied
            </p>
            <p className="text-xs text-gray-500 mt-1">
              To find nearby care, please allow location access in your browser
              settings and try again.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SecondaryButton onClick={onRetry} className="w-full text-sm">
            Try Again
          </SecondaryButton>
        </div>
        <HelplineBlock district={district} />
      </CardContainer>
    );
  }

  // ── Location Timeout ───────────────────────────────────────────────────────
  // User may not get a facility list — helpline shown as fallback.
  if (status === FACILITY_STATUS.LOCATION_TIMEOUT) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">{title}</h3>
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">⏱️</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Location request timed out
            </p>
            <p className="text-xs text-gray-500 mt-1">
              It took too long to get your location. Please check your signal
              and try again.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SecondaryButton onClick={onRetry} className="w-full text-sm">
            Retry
          </SecondaryButton>
        </div>
        <HelplineBlock district={district} />
      </CardContainer>
    );
  }

  // ── Location Unavailable ───────────────────────────────────────────────────
  // User has no location path at all — helpline is the only option.
  if (status === FACILITY_STATUS.LOCATION_UNAVAILABLE) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">{title}</h3>
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">📍</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Unable to determine your location
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Your device could not provide location data. Please ensure GPS is
              enabled and try again.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SecondaryButton onClick={onRetry} className="w-full text-sm">
            Retry
          </SecondaryButton>
        </div>
        <HelplineBlock district={district} />
      </CardContainer>
    );
  }

  // ── Places API Error ───────────────────────────────────────────────────────
  // Retry button stays; helpline added alongside it.
  if (status === FACILITY_STATUS.API_ERROR) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">{title}</h3>
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Could not load nearby facilities
            </p>
            <p className="text-xs text-gray-500 mt-1">
              A network or API error occurred. Please try again.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SecondaryButton onClick={onRetry} className="w-full text-sm">
            Retry Search
          </SecondaryButton>
        </div>
        <HelplineBlock district={district} />
      </CardContainer>
    );
  }

  // ── No Results ─────────────────────────────────────────────────────────────
  // Retry button stays; helpline added alongside it.
  if (status === FACILITY_STATUS.NO_RESULTS || (status === FACILITY_STATUS.LOADED && (!facilities || facilities.length === 0))) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">{title}</h3>
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">🏥</span>
          <div>
            <p className="text-sm font-medium text-gray-700">
              No facilities found nearby
            </p>
            <p className="text-xs text-gray-500 mt-1">
              We couldn't find healthcare facilities within range. Try expanding
              your search or contacting your local health authority.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SecondaryButton onClick={onRetry} className="w-full text-sm">
            Search Again
          </SecondaryButton>
        </div>
        <HelplineBlock district={district} />
      </CardContainer>
    );
  }

  // ── Facilities Loaded ──────────────────────────────────────────────────────
  if (status === FACILITY_STATUS.LOADED && facilities && facilities.length > 0) {
    return (
      <CardContainer>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">
          {title}
          <span className="ml-2 text-xs font-normal text-gray-400">
            {facilities.length} found · sorted by distance
          </span>
        </h3>
        <div className="space-y-2">
          {facilities.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      </CardContainer>
    );
  }

  // Fallback — should not be reached in normal usage
  return null;
};

export default FacilityList;
