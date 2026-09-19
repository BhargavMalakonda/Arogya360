/**
 * HeatmapPage.jsx  —  /dashboard/heatmap
 * ----------------------------------------
 * Health Official heatmap visualisation + investigation flow.
 *
 * Stage 6: Leaflet map, heat layer, hotspot list, filter controls.
 * Stage 7: Click-through investigation panels:
 *   Hotspot list / map click
 *     → Detail panel      (aggregate data already in hotspots[])
 *     → Investigation     (GET /api/hotspots/{pincode}/investigate)
 *     → Org reports       (GET /api/hotspots/{pincode}/reports?organization_name=X)
 *
 * Architecture:
 *   - Leaflet initialised imperatively (no react-leaflet), matching the
 *     existing Google Maps / placesService.js singleton pattern.
 *   - Heat layer is a self-contained canvas L.Layer subclass (no leaflet-heat).
 *   - CARTO Dark Matter basemap via VITE_CARTO_API_KEY.
 *   - apiFetch comes from DashboardLayout via Outlet context.
 *
 * Privacy:
 *   - Only aggregate pincode-level data shown on map and in detail panel.
 *   - Organization names exposed only after explicit "Investigate" click.
 *   - Individual reports: reported_date, category, case_count, status only.
 *   - uploader_uid / patient data never requested or displayed.
 *   - No health_reports data is sent to CARTO or any third party.
 *
 * ESI semantics:
 *   - ESI is a FILTER only. Never used as weight or severity score.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PINCODE_COORDS from '../../data/pincodeCoordinates.json';

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY;

const TILE_URL = CARTO_KEY
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const TILE_ATTRIBUTION = CARTO_KEY
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_CENTER = [12.9716, 80.2209];
const DEFAULT_ZOOM   = 10;

// ── Severity colour ────────────────────────────────────────────────────────────
function severityColor(n) {
  if (n >= 40) return '#ef4444';
  if (n >= 20) return '#f97316';
  if (n >= 10) return '#eab308';
  return '#22c55e';
}

// ── Canvas heat layer ──────────────────────────────────────────────────────────
// Self-contained Leaflet canvas layer.
// Points: [[lat, lng, intensity], ...]
// maxIntensity should equal the highest case_count in the current dataset so
// the colour scale is always relative to the data, not a hardcoded ceiling.
function createHeatLayer(points, options = {}) {
  const radius = options.radius  || 60;    // screen-pixel radius of the glow
  const blur   = options.blur    || 40;    // extra feather beyond radius
  const maxInt = options.maxIntensity || 1;

  const HeatLayer = L.Layer.extend({
    initialize(pts, opts) { this._points = pts || []; this._maxInt = (opts && opts.maxIntensity) || 1; },
    setPoints(pts, newMaxInt) {
      this._points = pts;
      if (newMaxInt !== undefined) this._maxInt = newMaxInt || 1;
      if (this._canvas) this._draw();
    },
    onAdd(map) {
      this._map = map;
      const sz = map.getSize();
      this._canvas = L.DomUtil.create('canvas', 'leaflet-heat-layer');
      Object.assign(this._canvas.style, {
        position: 'absolute', top: '0', left: '0',
        pointerEvents: 'none',
        // overlayPane z-index in Leaflet is 400; use 401 to sit above tiles
        zIndex: '401',
      });
      this._canvas.width  = sz.x;
      this._canvas.height = sz.y;
      // Use overlayPane so the heat canvas moves with pan/zoom
      map.getPanes().overlayPane.appendChild(this._canvas);
      map.on('moveend zoomend resize', this._reset, this);
      this._reset();
    },
    onRemove(map) {
      map.getPanes().overlayPane.removeChild(this._canvas);
      map.off('moveend zoomend resize', this._reset, this);
    },
    _reset() {
      L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]));
      const sz = this._map.getSize();
      this._canvas.width  = sz.x;
      this._canvas.height = sz.y;
      this._draw();
    },
    _draw() {
      const ctx = this._canvas.getContext('2d');
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

      for (const [lat, lng, intensity] of this._points) {
        const pt = this._map.latLngToContainerPoint([lat, lng]);
        const r  = radius + blur;

        // Normalise: lowest case count still gets at least 0.55 alpha so it
        // is visible on a dark map; highest gets 0.90.
        const norm  = Math.min(1, intensity / this._maxInt);
        const alpha = 0.55 + norm * 0.35;  // range 0.55 → 0.90

        // Green → yellow → orange → red based on normalised intensity
        // norm 0.0–0.25: green   (#22c55e)
        // norm 0.25–0.5: yellow  (#eab308)
        // norm 0.5–0.75: orange  (#f97316)
        // norm 0.75–1.0: red     (#ef4444)
        let r0, g0, b0;
        if (norm < 0.25) {
          r0 = 34;  g0 = 197; b0 = 94;   // green
        } else if (norm < 0.5) {
          r0 = 234; g0 = 179; b0 = 8;    // yellow
        } else if (norm < 0.75) {
          r0 = 249; g0 = 115; b0 = 22;   // orange
        } else {
          r0 = 239; g0 = 68;  b0 = 68;   // red
        }

        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
        grad.addColorStop(0,    `rgba(${r0},${g0},${b0},${alpha})`);
        grad.addColorStop(0.25, `rgba(${r0},${g0},${b0},${(alpha * 0.75).toFixed(2)})`);
        grad.addColorStop(0.6,  `rgba(${r0},${g0},${b0},${(alpha * 0.35).toFixed(2)})`);
        grad.addColorStop(1,    `rgba(${r0},${g0},${b0},0)`);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    },
  });
  return new HeatLayer(points, options);
}

// ── Shared small components ────────────────────────────────────────────────────
const CtrlSelect = ({ label, value, onChange, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </label>
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      fontSize: 12, fontWeight: 600, color: '#1e1f3b',
      padding: '5px 8px', borderRadius: 8,
      border: '1px solid #e2e8f0', background: '#fff',
      cursor: 'pointer', outline: 'none',
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const PanelCard = ({ children, onClose, title, backLabel, onBack }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15,16,40,0.55)', backdropFilter: 'blur(4px)',
    padding: 16,
  }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{
      background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520,
      maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
      }}>
        {onBack && (
          <button type="button" onClick={onBack} style={backBtnStyle} aria-label="Go back">
            ← {backLabel || 'Back'}
          </button>
        )}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1e1f3b' }}>{title}</span>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>
      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {children}
      </div>
    </div>
  </div>
);

const LoadingRow = () => (
  <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 13 }}>
    Loading…
  </div>
);

const ErrorRow = ({ msg }) => (
  <div style={{
    padding: '10px 14px', borderRadius: 8, fontSize: 13,
    background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
  }} role="alert">{msg}</div>
);

const StatusBadge = ({ status }) => {
  const cfg = {
    active:    { bg: '#dcfce7', color: '#15803d' },
    flagged:   { bg: '#fef9c3', color: '#854d0e' },
    corrected: { bg: '#dbeafe', color: '#1d4ed8' },
    confirmed: { bg: '#ede9fe', color: '#6d28d9' },
  }[status] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      background: cfg.bg, color: cfg.color,
    }}>{status}</span>
  );
};

// Inline styles
const backBtnStyle = {
  fontSize: 12, fontWeight: 600, color: '#5856D6',
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
};
const closeBtnStyle = {
  fontSize: 16, color: '#94a3b8', background: 'none',
  border: 'none', cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
};
const investigateBtn = {
  width: '100%', padding: '10px', borderRadius: 10, marginTop: 14,
  background: 'linear-gradient(135deg,#706DF2,#5856D6)',
  color: '#fff', fontSize: 13, fontWeight: 700,
  border: 'none', cursor: 'pointer',
};
const viewReportsBtn = {
  fontSize: 12, fontWeight: 600, color: '#5856D6',
  background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.20)',
  borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
};

const ALL_CATS = ['respiratory', 'cardiovascular', 'metabolic', 'general'];

// ── Main component ─────────────────────────────────────────────────────────────
const HeatmapPage = () => {
  const { apiFetch } = useOutletContext();

  // Map refs
  const mapRef         = useRef(null);
  const leafletRef     = useRef(null);
  const heatLayerRef   = useRef(null);
  const markerLayerRef = useRef(null);

  // Filter state
  const [period,   setPeriod]   = useState('7d');
  const [category, setCategory] = useState('all');
  const [esiLevel, setEsiLevel] = useState('2');

  // Hotspot list state
  const [hotspots, setHotspots] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Selected pincode (for map highlight + panel trigger)
  const [selected, setSelected] = useState(null);  // pincode string | null

  // ── Panel state machine ──────────────────────────────────────────────────
  // null → 'detail' → 'investigate' → 'org_reports'
  const [panelView,      setPanelView]      = useState(null);
  const [detailSpot,     setDetailSpot]     = useState(null);  // hotspot object from hotspots[]
  const [invData,        setInvData]        = useState(null);  // /investigate response
  const [invLoading,     setInvLoading]     = useState(false);
  const [invError,       setInvError]       = useState('');
  const [selectedOrg,    setSelectedOrg]    = useState(null);  // org object
  const [orgReports,     setOrgReports]     = useState(null);  // /reports response
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError,   setReportsError]   = useState('');

  // ── Flag-report state (inside org_reports panel) ──────────────────────────
  const [flagTarget,    setFlagTarget]    = useState(null);   // report obj being flagged
  const [flagReason,    setFlagReason]    = useState('');
  const [flagMessage,   setFlagMessage]   = useState('');
  const [flagging,      setFlagging]      = useState(false);
  const [flagError,     setFlagError]     = useState('');
  const [flagSuccess,   setFlagSuccess]   = useState('');

  // ── Fetch hotspots ────────────────────────────────────────────────────────
  const fetchHotspots = useCallback(async (p, c, e) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/hotspots?period=${p}&category=${c}&esi_level=${e}`);
      if (res.status === 403) { setError('Access denied.'); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setHotspots(data.hotspots || []);
    } catch (err) {
      console.error('[HeatmapPage] fetchHotspots:', err.message);
      setError('Could not load hotspot data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchHotspots(period, category, esiLevel); }, []); // eslint-disable-line
  useEffect(() => { fetchHotspots(period, category, esiLevel); }, [period, category, esiLevel]); // eslint-disable-line

  // ── Initialise Leaflet (once) ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: 'abcd', maxZoom: 18 }).addTo(map);
    if (!CARTO_KEY) console.warn('[HeatmapPage] VITE_CARTO_API_KEY not set — using OSM fallback.');
    const heat = createHeatLayer([], { radius: 60, blur: 40, maxIntensity: 1 });
    heat.addTo(map);
    heatLayerRef.current = heat;
    markerLayerRef.current = L.layerGroup().addTo(map);
    leafletRef.current = map;
    return () => { map.remove(); leafletRef.current = null; heatLayerRef.current = null; };
  }, []);

  // ── Update heat layer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!heatLayerRef.current) return;
    const points = [];
    const skipped = [];

    // Compute maxIntensity from the actual data so the colour scale is always
    // relative — even a single hotspot with case_count=7 will be fully visible.
    const maxCaseCount = hotspots.reduce((m, s) => Math.max(m, s.case_count || 0), 1);

    for (const spot of hotspots) {
      const coord = PINCODE_COORDS[spot.pincode];
      if (!coord) { skipped.push(spot.pincode); continue; }
      points.push([coord.lat, coord.lng, spot.case_count]);
    }
    if (skipped.length > 0) {
      console.warn(`[HeatmapPage] No coordinates for pincode(s): ${skipped.join(', ')}. Add to pincodeCoordinates.json.`);
    }
    // Pass the dynamic maxIntensity so low case counts are still visible
    heatLayerRef.current.setPoints(points, maxCaseCount);
  }, [hotspots]);

  // ── Select pincode: highlight on map + open detail panel ─────────────────
  const handleSelectPin = useCallback((pincode) => {
    setSelected(pincode);

    // Map highlight
    const coord = PINCODE_COORDS[pincode];
    if (coord && leafletRef.current) {
      leafletRef.current.flyTo([coord.lat, coord.lng], 13, { duration: 0.8 });
      markerLayerRef.current.clearLayers();
      L.circle([coord.lat, coord.lng], {
        radius: 1200, color: '#5856D6', fillColor: 'transparent',
        weight: 2, dashArray: '6 4', opacity: 0.85,
      }).addTo(markerLayerRef.current);
    }

    // Find the hotspot object from already-fetched data — no extra API call
    const spot = hotspots.find(h => h.pincode === pincode) || { pincode };
    setDetailSpot(spot);
    setInvData(null);
    setSelectedOrg(null);
    setOrgReports(null);
    setInvError('');
    setReportsError('');
    setPanelView('detail');
  }, [hotspots]);

  const closePanel = useCallback(() => {
    setPanelView(null);
    setDetailSpot(null);
    setInvData(null);
    setSelectedOrg(null);
    setOrgReports(null);
  }, []);

  // ── Investigate: fetch org breakdown ─────────────────────────────────────
  const handleInvestigate = useCallback(async () => {
    if (!detailSpot) return;
    setInvLoading(true);
    setInvError('');
    setPanelView('investigate');
    try {
      const res = await apiFetch(
        `/api/hotspots/${detailSpot.pincode}/investigate?period=${period}&category=${category}`,
      );
      if (res.status === 403) { setInvError('Access denied.'); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setInvData(await res.json());
    } catch (err) {
      console.error('[HeatmapPage] investigate:', err.message);
      setInvError('Could not load investigation data. Please try again.');
    } finally {
      setInvLoading(false);
    }
  }, [apiFetch, detailSpot, period, category]);

  // ── Org reports ────────────────────────────────────────────────────────────
  const handleViewReports = useCallback(async (org) => {
    setSelectedOrg(org);
    setOrgReports(null);
    setReportsError('');
    setReportsLoading(true);
    setPanelView('org_reports');
    try {
      const params = new URLSearchParams({
        organization_name: org.organization_name,
        period,
        category,
      });
      const res = await apiFetch(
        `/api/hotspots/${detailSpot.pincode}/reports?${params}`,
      );
      if (res.status === 403) { setReportsError('Access denied.'); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setOrgReports(await res.json());
    } catch (err) {
      console.error('[HeatmapPage] org reports:', err.message);
      setReportsError('Could not load reports. Please try again.');
    } finally {
      setReportsLoading(false);
    }
  }, [apiFetch, detailSpot, period, category]);

  // ── Submit flag ────────────────────────────────────────────────────────────
  const handleFlagSubmit = useCallback(async () => {
    if (!flagTarget?.id) return;
    if (!flagReason.trim() || !flagMessage.trim()) {
      setFlagError('Reason and message are required.');
      return;
    }
    setFlagging(true);
    setFlagError('');
    try {
      const res = await apiFetch('/api/corrections/flag', {
        method: 'POST',
        body: JSON.stringify({
          report_id: flagTarget.id,
          reason:    flagReason.trim(),
          message:   flagMessage.trim(),
        }),
      });
      if (res.status === 403) { setFlagError('Access denied.'); return; }
      if (res.status === 409) {
        const d = await res.json();
        setFlagError(d.detail || 'This report cannot be flagged in its current state.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setFlagSuccess('Report flagged. The contributor will be notified.');
      setFlagTarget(null);
      setFlagReason('');
      setFlagMessage('');
      // Re-fetch org reports to reflect updated status
      if (detailSpot && selectedOrg) {
        const params = new URLSearchParams({
          organization_name: selectedOrg.organization_name,
          period,
          category,
        });
        const r2 = await apiFetch(`/api/hotspots/${detailSpot.pincode}/reports?${params}`);
        if (r2.ok) setOrgReports(await r2.json());
      }
    } catch (err) {
      console.error('[HeatmapPage] flag:', err.message);
      setFlagError('Could not submit flag. Please try again.');
    } finally {
      setFlagging(false);
    }
  }, [apiFetch, flagTarget, flagReason, flagMessage, detailSpot, selectedOrg, period, category]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const PERIOD_OPTS   = [{ value:'7d',label:'Last 7 days'},{value:'14d',label:'Last 14 days'},{value:'30d',label:'Last 30 days'}];
  const CATEGORY_OPTS = [
    { value:'all',label:'All categories'},{value:'respiratory',label:'Respiratory'},
    { value:'cardiovascular',label:'Cardiovascular'},{value:'metabolic',label:'Metabolic'},
    { value:'general',label:'General / Viral'},
  ];
  const ESI_OPTS = [1,2,3,4,5].map(n => ({ value: String(n), label: `ESI-${n}` }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12,
        background: 'rgba(255,255,255,0.90)', border: '1px solid #e2e8f0',
        borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 8px rgba(88,86,214,0.06)',
      }}>
        <CtrlSelect label="Period"              value={period}   onChange={setPeriod}   options={PERIOD_OPTS}   />
        <CtrlSelect label="Category"            value={category} onChange={setCategory} options={CATEGORY_OPTS} />
        <CtrlSelect label="ESI level (filter)"  value={esiLevel} onChange={setEsiLevel} options={ESI_OPTS}      />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <span style={{ fontSize: 12, color: '#5856D6', fontWeight: 600 }}>Loading…</span>}
          {!CARTO_KEY && (
            <span style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', padding: '3px 8px', borderRadius: 6 }}>
              ⚠ VITE_CARTO_API_KEY not set — using OSM tiles
            </span>
          )}
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }} role="alert">{error}</div>}

      {/* Map + list */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            ref={mapRef}
            style={{ height: 480, borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(88,86,214,0.08)', background: '#1a1a2e' }}
            aria-label="Disease hotspot heatmap — aggregate pincode-level data"
          />
          {hotspots.length === 0 && !loading && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ background: 'rgba(30,31,59,0.75)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, fontSize: 12 }}>
                No hotspot data for the selected filters
              </span>
            </div>
          )}
        </div>

        {/* Hotspot list */}
        <div style={{ width: 220, flexShrink: 0, background: 'rgba(255,255,255,0.90)', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 2px 8px rgba(88,86,214,0.06)', maxHeight: 480, overflowY: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#5856D6', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Hotspots</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>click to investigate</p>
          </div>
          {hotspots.length === 0 && !loading && <p style={{ fontSize: 12, color: '#94a3b8', padding: '12px 14px', margin: 0 }}>No data</p>}
          {hotspots.map(spot => {
            const isSel    = selected === spot.pincode;
            const color    = severityColor(spot.case_count);
            const hasCoord = Boolean(PINCODE_COORDS[spot.pincode]);
            return (
              <button
                key={spot.pincode}
                type="button"
                onClick={() => handleSelectPin(spot.pincode)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px',
                  borderBottom: '1px solid #f8fafc',
                  background: isSel ? 'rgba(88,86,214,0.07)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, outline: 'none',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e1f3b', display: 'block' }}>
                    {spot.pincode}
                    {!hasCoord && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>—</span>}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {spot.case_count} cases
                    {spot.trend_label && (
                      <span style={{ marginLeft: 5, color: spot.trend_percent === null ? '#64748b' : spot.trend_percent >= 0 ? '#dc2626' : '#16a34a' }}>
                        {spot.trend_label}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
        Aggregate pincode-level data only. Individual patient locations are not shown or transmitted.
        ESI level is a report filter — it does not indicate outbreak severity.
      </p>

      {/* ── DETAIL PANEL ───────────────────────────────────────────────────── */}
      {panelView === 'detail' && detailSpot && (
        <PanelCard title={`Pincode ${detailSpot.pincode}`} onClose={closePanel}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Aggregate numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat label="Total cases" value={detailSpot.case_count ?? '—'} />
              <Stat
                label="Trend"
                value={detailSpot.trend_label || '—'}
                valueColor={
                  detailSpot.trend_percent === null ? '#64748b'
                  : detailSpot.trend_percent >= 0   ? '#dc2626'
                  :                                   '#16a34a'
                }
              />
              <Stat label="Organisations" value={detailSpot.organization_count ?? '—'} />
              <Stat label="ESI filter" value={`ESI-${esiLevel}`} />
            </div>

            {/* Category breakdown */}
            {detailSpot.categories && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                  Category breakdown
                </p>
                {ALL_CATS.map(cat => {
                  const n   = detailSpot.categories[cat] || 0;
                  const pct = detailSpot.case_count ? Math.round(n / detailSpot.case_count * 100) : 0;
                  return (
                    <div key={cat} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#475569', textTransform: 'capitalize' }}>{cat}</span>
                        <span style={{ fontWeight: 600, color: '#1e1f3b' }}>{n}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#5856D6', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', fontSize: 12, color: '#64748b' }}>
              Organisation names and individual reports are not shown here.
              Click "Investigate" to view the full breakdown.
            </div>

            <button type="button" onClick={handleInvestigate} style={investigateBtn}>
              Investigate →
            </button>
          </div>
        </PanelCard>
      )}

      {/* ── INVESTIGATION PANEL ────────────────────────────────────────────── */}
      {panelView === 'investigate' && detailSpot && (
        <PanelCard
          title={`Investigation — ${detailSpot.pincode}`}
          onClose={closePanel}
          onBack={() => setPanelView('detail')}
          backLabel="Detail"
        >
          {invLoading && <LoadingRow />}
          {invError   && <ErrorRow msg={invError} />}

          {!invLoading && !invError && invData && (
            <>
              {invData.organizations.length === 0 && (
                <p style={{ fontSize: 13, color: '#64748b' }}>No organisation data for the selected filters.</p>
              )}
              {invData.organizations.map((org, i) => (
                <div key={org.organization_name} style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 10,
                  border: '1px solid #e2e8f0', background: '#fafafa',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1e1f3b', margin: '0 0 2px' }}>{org.organization_name}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0, textTransform: 'capitalize' }}>
                        {org.organization_type} · {org.report_count} report{org.report_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#1e1f3b', margin: '0 0 2px', lineHeight: 1 }}>{org.case_count}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>cases</p>
                    </div>
                  </div>
                  {/* Mini category bar */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {ALL_CATS.filter(c => (org.categories[c] || 0) > 0).map(c => (
                      <span key={c} style={{ fontSize: 11, color: '#475569', background: 'rgba(88,86,214,0.07)', border: '1px solid rgba(88,86,214,0.14)', borderRadius: 6, padding: '2px 7px' }}>
                        {c}: {org.categories[c]}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => handleViewReports(org)} style={viewReportsBtn}>
                    View Reports
                  </button>
                </div>
              ))}
            </>
          )}
        </PanelCard>
      )}

      {/* ── ORG REPORTS PANEL ──────────────────────────────────────────────── */}
      {panelView === 'org_reports' && detailSpot && selectedOrg && (
        <PanelCard
          title={`Reports — ${selectedOrg.organization_name}`}
          onClose={closePanel}
          onBack={() => { setPanelView('investigate'); setFlagTarget(null); setFlagSuccess(''); setFlagError(''); }}
          backLabel="Investigation"
        >
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
            Pincode {detailSpot.pincode} · {period} · {category === 'all' ? 'All categories' : category}
          </p>

          {reportsLoading && <LoadingRow />}
          {reportsError   && <ErrorRow msg={reportsError} />}

          {flagSuccess && (
            <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12 }} role="status">
              ✓ {flagSuccess}
            </div>
          )}

          {!reportsLoading && !reportsError && orgReports && (
            <>
              {orgReports.reports.length === 0 && (
                <p style={{ fontSize: 13, color: '#64748b' }}>No reports found for the selected filters.</p>
              )}
              {orgReports.reports.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      {['Date','Category','Cases','Status','Action'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orgReports.reports.map((r, i) => (
                      <tr key={r.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '7px 8px', color: '#334155', whiteSpace: 'nowrap' }}>
                          {r.reported_date || '—'}
                        </td>
                        <td style={{ padding: '7px 8px', color: '#334155', textTransform: 'capitalize' }}>
                          {r.category}
                        </td>
                        <td style={{ padding: '7px 8px', color: '#334155', fontWeight: 600 }}>
                          {r.case_count}
                        </td>
                        <td style={{ padding: '7px 8px' }}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td style={{ padding: '7px 8px' }}>
                          {r.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => { setFlagTarget(r); setFlagReason(''); setFlagMessage(''); setFlagError(''); setFlagSuccess(''); }}
                              style={{ fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}
                            >
                              Flag
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
                Click "Flag" on an active report to request contributor verification.
              </p>
            </>
          )}

          {/* ── Inline flag form ──────────────────────────────────────────── */}
          {flagTarget && (
            <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fcd34d' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: '0 0 10px' }}>
                Flag for Correction — {flagTarget.reported_date} ({flagTarget.category}, {flagTarget.case_count} cases)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Reason *</label>
                  <input
                    type="text"
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                    placeholder="e.g. Possible data entry error"
                    maxLength={200}
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 7, border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Message to contributor *</label>
                  <textarea
                    value={flagMessage}
                    onChange={e => setFlagMessage(e.target.value)}
                    placeholder="Please verify the case count for this submission."
                    maxLength={1000}
                    rows={3}
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 7, border: '1px solid #e2e8f0', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                {flagError && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }} role="alert">{flagError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleFlagSubmit} disabled={flagging} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    {flagging ? 'Submitting…' : 'Submit Flag'}
                  </button>
                  <button type="button" onClick={() => { setFlagTarget(null); setFlagError(''); }} style={{ padding: '8px 14px', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 12, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </PanelCard>
      )}
    </div>
  );
};

// ── Stat tile ─────────────────────────────────────────────────────────────────
const Stat = ({ label, value, valueColor = '#1e1f3b' }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
    <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{label}</p>
    <p style={{ fontSize: 16, fontWeight: 700, color: valueColor, margin: 0, lineHeight: 1 }}>{value}</p>
  </div>
);

export default HeatmapPage;
