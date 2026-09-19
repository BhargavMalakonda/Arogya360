/**
 * FindCare.jsx — Nearby Healthcare Directory
 *
 * Route: /find-care  (ProtectedRoute with TopBar + BottomNav)
 *
 * On mount, immediately triggers the geolocation + Places search.
 * Displays results using the existing FacilityList component for
 * status handling (loading / permission denied / loaded / etc.).
 * Wide desktop layout — NOT a narrow centered column.
 *
 * DO NOT modify placesService.js, FacilityList.jsx, or any backend.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FacilityList, { FACILITY_STATUS } from '../components/FacilityList';
import { findNearbyCare } from '../lib/placesService';

// ── Geolocation helper (identical to original in Home.jsx) ────────────────────
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: 'UNAVAILABLE' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject({ code: 'PERMISSION_DENIED' });
        else if (err.code === 3) reject({ code: 'TIMEOUT' });
        else reject({ code: 'UNAVAILABLE' });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const IcLocation = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);

// ── FindCare page ─────────────────────────────────────────────────────────────

const FindCare = () => {
  const navigate = useNavigate();

  const [facilityStatus, setFacilityStatus] = useState(null);
  const [facilities,     setFacilities]     = useState([]);

  const loadNearbyCare = useCallback(async () => {
    setFacilityStatus(FACILITY_STATUS.LOADING);
    setFacilities([]);
    let lat, lng;
    try {
      ({ lat, lng } = await getGeolocation());
    } catch (geoErr) {
      if      (geoErr.code === 'PERMISSION_DENIED') setFacilityStatus(FACILITY_STATUS.PERMISSION_DENIED);
      else if (geoErr.code === 'TIMEOUT')           setFacilityStatus(FACILITY_STATUS.LOCATION_TIMEOUT);
      else                                           setFacilityStatus(FACILITY_STATUS.LOCATION_UNAVAILABLE);
      return;
    }
    try {
      const results = await findNearbyCare(lat, lng);
      setFacilities(results);
      setFacilityStatus(results.length === 0 ? FACILITY_STATUS.NO_RESULTS : FACILITY_STATUS.LOADED);
    } catch (err) {
      console.error('[FindCare] findNearbyCare error:', err);
      setFacilityStatus(FACILITY_STATUS.API_ERROR);
    }
  }, []);

  // Trigger search immediately on mount
  useEffect(() => { loadNearbyCare(); }, [loadNearbyCare]);

  // Derived header subtitle
  const subtitle = (() => {
    if (!facilityStatus || facilityStatus === FACILITY_STATUS.LOADING) return 'Locating nearby facilities…';
    if (facilityStatus === FACILITY_STATUS.LOADED && facilities.length > 0)
      return `${facilities.length} found · Sorted by distance`;
    return 'Find clinics, hospitals, and pharmacies within 5 km';
  })();

  return (
    <div className="page-enter">
      {/* ── Constrained content wrapper — wide desktop layout ──────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '1160px',
          margin: '0 auto',
          padding: '20px 24px 100px',
        }}
      >

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-brand-indigo transition-colors focus:outline-none mb-4"
          >
            <IcArrowLeft />
            Back to Home
          </button>

          {/* Title row */}
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(88,86,214,0.09)',
                border: '1px solid rgba(88,86,214,0.14)',
                color: '#5856D6',
              }}
            >
              <IcLocation />
            </div>
            <div>
              <h1 className="text-[24px] font-extrabold text-on-surface font-display leading-tight tracking-[-0.02em]">
                Nearby Healthcare
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        {/*
         * FacilityList handles all status states:
         *   loading / permission_denied / location_timeout /
         *   location_unavailable / loaded / no_results / api_error
         * Width override via a wrapper div so cards use full page width,
         * not the narrow max-w-sm of CardContainer inside FacilityList.
         */}
        <div
          style={{
            /* Override CardContainer's default narrow width */
            '--fc-max-width': '100%',
          }}
          className="find-care-wide"
        >
          <FacilityList
            facilities={facilities}
            status={facilityStatus}
            onRetry={loadNearbyCare}
            title="Nearby Healthcare"
          />
        </div>

      </div>
    </div>
  );
};

export default FindCare;
