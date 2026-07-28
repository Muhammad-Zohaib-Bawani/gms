import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import Modal from './Modal.jsx';
import Select from './Select.jsx';
import { createLocation, updateLocation } from '../../api/services/locationService.js';
import { LOCATION_TYPE, locationTypeOptions } from '../../enums/locationType.js';
import toast from '../../lib/toast.js';

// Leaflet's default marker icon references image paths that don't survive a
// bundler — without this the pin renders as a broken image.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = [25.2854, 51.5310]; // Doha, Qatar

// Every location in GMS is inside Qatar, so the picker is fenced to it: the map
// can't be panned away, clicks outside are rejected, and place search is filtered
// server-side. Padded a little past the mainland to keep offshore islands and
// the northern tip reachable.
const QATAR_SW = [24.40, 50.68];
const QATAR_NE = [26.20, 51.70];
const QATAR_BOUNDS = [QATAR_SW, QATAR_NE];
// Nominatim viewbox order is left,top,right,bottom (lon,lat,lon,lat).
const QATAR_VIEWBOX = `${QATAR_SW[1]},${QATAR_NE[0]},${QATAR_NE[1]},${QATAR_SW[0]}`;

const inQatar = ([lat, lng]) =>
  lat >= QATAR_SW[0] && lat <= QATAR_NE[0] && lng >= QATAR_SW[1] && lng <= QATAR_NE[1];

function ClickToPlacePin({ onPick }) {
  useMapEvents({
    click(e) { onPick([e.latlng.lat, e.latlng.lng]); },
  });
  return null;
}

// Leaflet reads `center` only at mount, so picking a search result has to move
// the map imperatively — otherwise the new pin lands off-screen.
function RecenterOnPoint({ point, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo(point, Math.max(map.getZoom(), zoom), { duration: 0.6 });
  }, [point, map, zoom]);
  return null;
}

// Free OSM reverse-geocoding — resolves a clicked point to a real place/street
// name instead of leaving the user staring at raw coordinates.
async function reverseGeocode(lat, lng, isAr) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': isAr ? 'ar' : 'en' } });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  return data?.name || data?.display_name || null;
}

// Forward geocoding — turns typed text into pickable places, so the map is a
// confirmation step rather than the only way in.
async function searchPlaces(query, isAr, signal) {
  // countrycodes + bounded viewbox keep results inside Qatar.
  const url = 'https://nominatim.openstreetmap.org/search'
    + `?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`
    + `&countrycodes=qa&viewbox=${QATAR_VIEWBOX}&bounded=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': isAr ? 'ar' : 'en' }, signal });
  if (!res.ok) throw new Error('Place search failed');
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .map((r) => ({
      id: r.place_id,
      name: r.name || r.display_name,
      detail: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    // Belt and braces — never surface a pin the map itself would refuse.
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inQatar([r.lat, r.lng]));
}

// Pass `location` (an existing row: { id, address, type, latitude, longitude })
// to edit it — same form, PUT instead of POST.
//
// `pickOnly` turns off persistence: no API call, no type dropdown, and onSelect
// receives the raw { latitude, longitude, address } instead of a saved row. Use
// it when the parent form owns the write (e.g. Organizations, where the backend
// creates the Location as part of saving the organisation) — otherwise
// cancelling the parent form would leave an orphaned Location behind.
export default function LocationPickerModal({ open, onClose, lang, onSelect, defaultType = LOCATION_TYPE.VENUE, location = null, pickOnly = false }) {
  const isAr = lang === 'ar';
  const [point, setPoint] = useState(null); // [lat, lng] | null
  const [address, setAddress] = useState('');
  const [type, setType] = useState(defaultType);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  // Place search (typing in the name field).
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Set whenever we write `address` ourselves (prefill, reverse geocode, picking
  // a result) so the debounce below doesn't fire a search for text the user
  // didn't type — which would reopen the dropdown right after they chose.
  const skipSearchRef = useRef(true);
  const boxRef = useRef(null);

  // Prefill on open — the row's coords come back as strings.
  useEffect(() => {
    if (!open) return;
    skipSearchRef.current = true;
    setPoint(location ? [Number(location.latitude), Number(location.longitude)] : null);
    setAddress(location?.address || '');
    setType(location?.type || defaultType);
    setResults([]);
    setShowResults(false);
    setActiveIndex(-1);
  }, [open, location, defaultType]);

  // Debounced forward geocode. Nominatim asks for ≤1 req/sec, hence the wait.
  useEffect(() => {
    if (!open) return undefined;
    if (skipSearchRef.current) { skipSearchRef.current = false; return undefined; }

    const q = address.trim();
    if (q.length < 3) { setResults([]); setShowResults(false); setSearching(false); return undefined; }

    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, isAr, controller.signal);
        setResults(found);
        setShowResults(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err?.name !== 'AbortError') { setResults([]); setShowResults(false); }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [address, open, isAr]);

  // Dismiss the dropdown when focus/click moves elsewhere.
  useEffect(() => {
    if (!showResults) return undefined;
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setShowResults(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showResults]);

  function handleClose() {
    setPoint(null);
    setAddress('');
    setType(defaultType);
    setResolvingAddress(false);
    setResults([]);
    setShowResults(false);
    setActiveIndex(-1);
    skipSearchRef.current = true;
    onClose?.();
  }

  async function handlePick(pt) {
    // maxBounds keeps the viewport in Qatar, but the edge of the view can still
    // sit just outside it — so the click itself is checked too.
    if (!inQatar(pt)) {
      toast.warning(isAr ? 'يجب أن يكون الموقع داخل قطر' : 'Location must be inside Qatar');
      return;
    }
    setPoint(pt);
    setShowResults(false);
    setResolvingAddress(true);
    try {
      const name = await reverseGeocode(pt[0], pt[1], isAr);
      skipSearchRef.current = true;
      setAddress(name || '');
    } catch {
      // Reverse geocoding failed (offline, rate-limited, etc.) — the user can
      // still type a name manually, or fall back to raw coordinates at confirm.
    } finally {
      setResolvingAddress(false);
    }
  }

  // Chose a search result: drop the pin there and adopt its name.
  function handleChooseResult(r) {
    skipSearchRef.current = true;
    setPoint([r.lat, r.lng]);
    setAddress(r.name);
    setResults([]);
    setShowResults(false);
    setActiveIndex(-1);
  }

  function handleSearchKeyDown(e) {
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i <= 0 ? results.length : i) - 1); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleChooseResult(results[activeIndex]); }
    else if (e.key === 'Escape') { setShowResults(false); }
  }

  async function handleConfirm() {
    if (!point) return;
    const [lat, lng] = point;
    const label = address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // Pick-only: hand the coordinates back and let the parent persist them.
    if (pickOnly) {
      onSelect?.({ latitude: String(lat), longitude: String(lng), address: address.trim() || null, label });
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const body = {
        latitude: String(lat),
        longitude: String(lng),
        address: address.trim() || null,
        type,
      };
      const res = location ? await updateLocation(location.id, body) : await createLocation(body);
      onSelect?.({ id: res?.id || location?.id, label });
      handleClose();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر حفظ الموقع' : 'Could not save location');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: 10.5, color: 'var(--ink-mute)',
    textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
  };

  // Leaflet reads `center` once, at mount. Fall back to Doha if a pre-existing
  // row somehow sits outside Qatar, so the map never opens fighting maxBounds.
  const prefilled = location ? [Number(location.latitude), Number(location.longitude)] : null;
  const initialCenter = prefilled && inQatar(prefilled) ? prefilled : DEFAULT_CENTER;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={location ? (isAr ? 'تعديل الموقع' : 'Edit location') : (isAr ? 'اختر موقعاً' : 'Pick a location')}
      subtitle={isAr
        ? 'داخل قطر فقط — ابحث بالاسم أدناه أو انقر على الخريطة'
        : 'Qatar only — search by name below, or click the map to drop a pin'}
      width={560}
      footer={
        <>
          <button className="btn" onClick={handleClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleConfirm} disabled={!point || saving}>
            {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
              : location ? (isAr ? 'حفظ' : 'Save')
              : (isAr ? 'تأكيد' : 'Confirm')}
          </button>
        </>
      }
    >
      <div style={{ height: 320, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
        {/* Centered from the `location` prop, not state — Leaflet only reads
            `center` at mount, and the prefill effect runs after that. */}
        <MapContainer
          center={initialCenter}
          zoom={location ? 15 : 10}
          minZoom={8}
          maxBounds={QATAR_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlacePin onPick={handlePick} />
          <RecenterOnPoint point={point} />
          {point && <Marker position={point} />}
        </MapContainer>
      </div>
      <div ref={boxRef} style={{ position: 'relative' }}>
        <label style={labelStyle}>
          {isAr ? 'اسم الموقع' : 'Location name'}
          {(resolvingAddress || searching) && (
            <span style={{ textTransform: 'none', letterSpacing: 'normal', marginLeft: 6, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
              {resolvingAddress
                ? (isAr ? '· جارٍ التعرّف على الموقع…' : '· looking up nearby name…')
                : (isAr ? '· جارٍ البحث…' : '· searching…')}
            </span>
          )}
        </label>
        <input
          style={inputStyle}
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => { if (results.length) setShowResults(true); }}
          autoComplete="off"
          placeholder={isAr ? 'ابحث عن مكان في قطر أو انقر على الخريطة' : 'Search a place in Qatar, or click the map'}
        />

        {/* Opens upward, over the map: the modal body scrolls, so a downward
            list would be clipped at the bottom edge. */}
        {showResults && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% - 2px)', left: 0, right: 0, zIndex: 1200,
            background: 'var(--surface-solid, #14161c)', border: '1px solid var(--glass-border)',
            borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            maxHeight: 240, overflowY: 'auto', marginBottom: 6,
          }}>
            {results.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-faint)' }}>
                {isAr ? 'لا توجد نتائج' : 'No matching places'}
              </div>
            ) : results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => handleChooseResult(r)}
                style={{
                  display: 'block', width: '100%', textAlign: isAr ? 'right' : 'left',
                  padding: '9px 12px', border: 0, cursor: 'pointer', color: 'var(--ink)',
                  background: i === activeIndex ? '#dedede' : 'white',
                  borderBottom: i < results.length - 1 ? '1px solid var(--glass-border)' : 0,
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 2 }}>{r.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--ink-faint)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.detail}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Pick-only callers own the type (it's implied by the parent record). */}
      {!pickOnly && (
        <div>
          <label style={labelStyle}>{isAr ? 'نوع الموقع' : 'Location type'} *</label>
          <Select value={type} onChange={setType} options={locationTypeOptions(isAr)} />
        </div>
      )}
      {point && (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
          {point[0].toFixed(5)}, {point[1].toFixed(5)}
        </div>
      )}
    </Modal>
  );
}
