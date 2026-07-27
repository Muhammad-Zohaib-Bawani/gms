import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

function ClickToPlacePin({ onPick }) {
  useMapEvents({
    click(e) { onPick([e.latlng.lat, e.latlng.lng]); },
  });
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

// Pass `location` (an existing row: { id, address, type, latitude, longitude })
// to edit it — same form, PUT instead of POST.
export default function LocationPickerModal({ open, onClose, lang, onSelect, defaultType = LOCATION_TYPE.VENUE, location = null }) {
  const isAr = lang === 'ar';
  const [point, setPoint] = useState(null); // [lat, lng] | null
  const [address, setAddress] = useState('');
  const [type, setType] = useState(defaultType);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prefill on open — the row's coords come back as strings.
  useEffect(() => {
    if (!open) return;
    setPoint(location ? [Number(location.latitude), Number(location.longitude)] : null);
    setAddress(location?.address || '');
    setType(location?.type || defaultType);
  }, [open, location, defaultType]);

  function handleClose() {
    setPoint(null);
    setAddress('');
    setType(defaultType);
    setResolvingAddress(false);
    onClose?.();
  }

  async function handlePick(pt) {
    setPoint(pt);
    setResolvingAddress(true);
    try {
      const name = await reverseGeocode(pt[0], pt[1], isAr);
      setAddress(name || '');
    } catch {
      // Reverse geocoding failed (offline, rate-limited, etc.) — the user can
      // still type a name manually, or fall back to raw coordinates at confirm.
    } finally {
      setResolvingAddress(false);
    }
  }

  async function handleConfirm() {
    if (!point) return;
    setSaving(true);
    try {
      const [lat, lng] = point;
      const body = {
        latitude: String(lat),
        longitude: String(lng),
        address: address.trim() || null,
        type,
      };
      const res = location ? await updateLocation(location.id, body) : await createLocation(body);
      onSelect?.({
        id: res?.id || location?.id,
        label: address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={location ? (isAr ? 'تعديل الموقع' : 'Edit location') : (isAr ? 'اختر موقعاً' : 'Pick a location')}
      subtitle={isAr ? 'انقر على الخريطة لتحديد الموقع' : 'Click on the map to drop a pin'}
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
          center={location ? [Number(location.latitude), Number(location.longitude)] : DEFAULT_CENTER}
          zoom={location ? 15 : 11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlacePin onPick={handlePick} />
          {point && <Marker position={point} />}
        </MapContainer>
      </div>
      <div>
        <label style={labelStyle}>
          {isAr ? 'اسم الموقع' : 'Location name'}
          {resolvingAddress && <span style={{ textTransform: 'none', letterSpacing: 'normal', marginLeft: 6, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
            {isAr ? '· جارٍ التعرّف على الموقع…' : '· looking up nearby name…'}
          </span>}
        </label>
        <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)}
          placeholder={point
            ? (isAr ? 'لم يتم العثور على اسم — أدخله يدوياً' : 'No name found — type one in')
            : (isAr ? 'انقر على الخريطة أولاً' : 'Click the map first')}/>
      </div>
      <div>
        <label style={labelStyle}>{isAr ? 'نوع الموقع' : 'Location type'} *</label>
        <Select value={type} onChange={setType} options={locationTypeOptions(isAr)} />
      </div>
      {point && (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
          {point[0].toFixed(5)}, {point[1].toFixed(5)}
        </div>
      )}
    </Modal>
  );
}
