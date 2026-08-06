import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { StatusChip } from '../components/UI';
import Select from '../components/ui/Select';
import DataTable from '../components/ui/DataTable';
import DateField from '../components/ui/DateField';
import { addDaysIso, fmtDate, fmtTime } from '../lib/date';
import { getVehicles, getVehicleBookings } from '../api/services/vehicleService';
import { getDrivers } from '../api/services/travelService';
import { vehicleLabel, driverLabel } from './guests/modals/TravelAccordion';
import FleetBookingsGrid from './fleet/FleetBookingsGrid';

const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};

// TripStatus codes (Core/Constants/TransportStatuses.cs). Cancelled never
// appears — the endpoint filters those out.
const STATUS_LABEL = {
  new:           { en: 'New',         ar: 'جديد' },
  pending:       { en: 'Pending',     ar: 'قيد الانتظار' },
  assigned:      { en: 'Assigned',    ar: 'مُعيَّن' },
  'in-progress': { en: 'En Route',    ar: 'في الطريق' },
  arrived:       { en: 'At Pickup',   ar: 'وصل للاستلام' },
  'in-transit':  { en: 'In Transit',  ar: 'في الرحلة' },
  completed:     { en: 'Completed',   ar: 'مكتمل' },
};

// Portal-wide display format (lib/date): '05-08-2026' and '09:30'.
const timeOf = (iso) => fmtTime(iso);
const dayOf = (iso) => fmtDate(iso);

// Fleet › Bookings: when is each vehicle taken, and with which driver. Read-only
// — bookings are created and edited from the Travel screen. Rows arrive sorted by
// vehicle then pickup time, so a car's day reads as one block.
export default function FleetBookingsView({ lang, activeEventId }) {
  const isAr = lang === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // The list answers "show me every booking"; the grid answers "what's happening
  // at 09:00 on the 7th". Same rows, same filters — only the shape differs.
  const [view, setView] = useState('list');

  // Filters. Empty = no bound, i.e. every booking for the event.
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    if (!activeEventId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      setRows((await getVehicleBookings({
        eventId: activeEventId,
        from: from || undefined,
        // The server's upper bound is exclusive, so shift it a day to make the
        // date the user picked an inclusive one.
        to: to ? addDaysIso(to, 1) : undefined,
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
      })) || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [activeEventId, from, to, vehicleId, driverId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeEventId) { setVehicles([]); return; }
    getVehicles(activeEventId).then((v) => setVehicles(v || [])).catch(() => setVehicles([]));
  }, [activeEventId]);

  useEffect(() => {
    getDrivers().then((d) => setDrivers(d || [])).catch(() => setDrivers([]));
  }, []);

  const columns = useMemo(() => [
    {
      id: 'vehicle', header: isAr ? 'المركبة' : 'Vehicle', accessorKey: 'vehicleNumber',
      cell: ({ row: { original: r } }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {r.vehicleImage
            ? <img src={r.vehicleImage} alt="" style={{ width: 40, height: 28, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
            : <div style={{ width: 40, height: 28, borderRadius: 5, flexShrink: 0, background: 'var(--surface-soft-3)', display: 'grid', placeItems: 'center' }}>
                <Icon name="car" size={13} style={{ color: 'var(--ink-faint)' }} />
              </div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.vehicleNumber || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
              {[r.vehicleModel, r.vehicleTypeName].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'provider', header: isAr ? 'المزوّد' : 'Provider', accessorKey: 'fleetProviderName',
      cell: ({ getValue }) => (
        <span style={{ fontSize: 12.5 }}>{getValue() || (isAr ? 'داخلي' : 'In-house')}</span>
      ),
    },
    {
      id: 'when', header: isAr ? 'الحجز' : 'Booked', accessorKey: 'pickupTime',
      cell: ({ row: { original: r } }) => (
        <div>
          <div style={{ fontSize: 12.5 }}>{dayOf(r.pickupTime)}</div>
          <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--ink-dim)', direction: 'ltr' }}>
            {timeOf(r.pickupTime)} → {timeOf(r.dropoffTime)}
          </div>
        </div>
      ),
    },
    {
      id: 'driver', header: isAr ? 'السائق' : 'Driver', accessorKey: 'driverName',
      cell: ({ row: { original: r } }) => (
        r.driverName
          ? <div>
              <div style={{ fontSize: 12.5 }}>{r.driverName}</div>
              {r.driverPhone && (
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', direction: 'ltr' }}>{r.driverPhone}</div>
              )}
            </div>
          // A booking with no driver yet is exactly what a dispatcher is looking
          // for on this screen, so it's called out rather than left blank.
          : <span style={{ fontSize: 12, color: '#e0c47e' }}>{isAr ? 'لم يُعيَّن' : 'Unassigned'}</span>
      ),
    },
    {
      id: 'guest', header: isAr ? 'الضيف' : 'Guest', accessorKey: 'guestName',
      cell: ({ getValue }) => <span style={{ fontSize: 12.5 }}>{getValue() || '—'}</span>,
    },
    {
      id: 'route', header: isAr ? 'المسار' : 'Route', enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>
          {[r.pickup, r.dropoff].filter(Boolean).join(' → ') || '—'}
        </span>
      ),
    },
    {
      id: 'status', header: isAr ? 'الحالة' : 'Status', accessorKey: 'status', size: 120,
      cell: ({ getValue }) => {
        const code = (getValue() || '').toLowerCase();
        return <StatusChip status={code} label={STATUS_LABEL[code]?.[isAr ? 'ar' : 'en'] || code || '—'} />;
      },
    },
  ], [isAr]);

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 170 }}>
        <label style={labelStyle}>{isAr ? 'المركبة' : 'Vehicle'}</label>
        <Select
          value={vehicleId} onChange={(v) => setVehicleId(v || '')}
          options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
          placeholder={isAr ? 'الكل' : 'All'} isClearable
        />
      </div>
      <div style={{ minWidth: 170 }}>
        <label style={labelStyle}>{isAr ? 'السائق' : 'Driver'}</label>
        <Select
          value={driverId} onChange={(v) => setDriverId(v || '')}
          options={drivers.map((d) => ({ value: d.id, label: driverLabel(d) }))}
          placeholder={isAr ? 'الكل' : 'All'} isClearable
        />
      </div>
      <div style={{ width: 150 }}>
        <label style={labelStyle}>{isAr ? 'من' : 'From'}</label>
        <DateField value={from} onChange={(v) => setFrom(v || '')} maxDate={to || undefined} placeholder="DD-MM-YYYY" />
      </div>
      <div style={{ width: 150 }}>
        <label style={labelStyle}>{isAr ? 'إلى' : 'To'}</label>
        <DateField value={to} onChange={(v) => setTo(v || '')} minDate={from || undefined} placeholder="DD-MM-YYYY" />
      </div>
      {(vehicleId || driverId || from || to) && (
        <button className="btn" onClick={() => { setVehicleId(''); setDriverId(''); setFrom(''); setTo(''); }}>
          {isAr ? 'مسح' : 'Clear'}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'حجوزات الأسطول' : 'Bookings'}</h1>
          <div className="page-sub">
            {isAr
              ? 'متى تكون كل مركبة محجوزة، ومع أي سائق'
              : 'When each vehicle is booked, and with which driver'}
          </div>
        </div>
        {activeEventId && (
          <div className="page-actions">
            {[
              { key: 'list', label: isAr ? 'قائمة' : 'List', icon: 'reports' },
              { key: 'grid', label: isAr ? 'شبكة' : 'Grid', icon: 'meetings' },
            ].map((v) => (
              <button key={v.key} className={`btn${view === v.key ? ' primary' : ''}`}
                style={{ fontSize: 12 }} onClick={() => setView(v.key)}>
                <Icon name={v.icon} size={13} /> {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!activeEventId ? (
        <div style={{
          padding: '10px 16px', borderRadius: 10, fontSize: 13, color: '#e0c47e',
          background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)',
        }}>
          <Icon name="alert" size={14} /> {isAr ? 'اختر فعالية أولاً' : 'Select an event first'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {view === 'grid' ? (
            <>
              {/* The grid has no DataTable to host the filters, so they sit above it. */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)' }}>
                {toolbar}
              </div>
              <FleetBookingsGrid rows={rows} loading={loading} isAr={isAr} />
            </>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              showSearch
              toolbar={toolbar}
              pageSize={15}
              searchPlaceholder={isAr ? 'بحث بالمركبة أو السائق أو الضيف…' : 'Search vehicle, driver or guest…'}
              emptyText={isAr ? 'لا توجد حجوزات' : 'No bookings'}
            />
          )}
        </div>
      )}
    </div>
  );
}
