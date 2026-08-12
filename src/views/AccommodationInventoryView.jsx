import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import DataTable from '../components/ui/DataTable';
import DateField from '../components/ui/DateField';
import ActionMenu from '../components/ui/ActionMenu';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import { fmtDate } from '../lib/date';
import { getHotels, getRoomTypes } from '../api/services/travelService';
import {
  getHotelContracts, createHotelContract, updateHotelContract, deleteHotelContract,
  getRoomInventory, createRoomInventory, updateRoomInventory, deleteRoomInventory,
  setRoomInventoryNight, getRoomAvailability,
} from '../api/services/accommodationInventoryService';
import RoomAvailabilityGrid, { monthsOf } from './accommodation/RoomAvailabilityGrid';
import { toCsv, downloadCsv } from '../lib/csvExport';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const errorStyle = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};
const hintStyle = { fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 };
const errText = { ...hintStyle, color: '#e05050' };

const EMPTY_CONTRACT = { hotelId: '', notes: '' };
const EMPTY_BLOCK = { contractId: '', roomTypeId: '', roomCount: '', fromDate: '', toDate: '' , notes: '' };

// Accommodation › Inventory. Two tabs, in the order the data has to be entered:
// a Contract makes a hotel usable by the event, then room blocks under it say how
// many rooms of each type are held on which nights. The accommodation booking form
// reads both — its hotel list is the contracts, its capacity cap is the blocks.
export default function AccommodationInventoryView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Travel.Manage');

  const [tab, setTab] = useState('contracts');

  const [contracts, setContracts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  // The grid answers "what's left"; the list answers "what did we contract for".
  const [roomsMode, setRoomsMode] = useState('grid');
  // Applies to both views on the Rooms tab. Client-side — everything is loaded.
  // Availability is always scoped to ONE hotel (there is no all-hotels view: a
  // column sum across hotels adds up unrelated room types), and to one month.
  const [roomsHotel, setRoomsHotel] = useState('');
  const [roomsMonth, setRoomsMonth] = useState('');

  // One modal per tab — the two forms share nothing but their shape.
  const [contractModal, setContractModal] = useState(null); // { editing, form } | null
  const [blockModal, setBlockModal] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!activeEventId) { setContracts([]); setBlocks([]); setAvailability(null); setLoading(false); return; }
    setLoading(true);
    try {
      // Availability is derived from the same blocks, so it's refetched with them —
      // editing a block changes the grid, and a stale grid is worse than none.
      const [c, b, a] = await Promise.all([
        getHotelContracts(activeEventId),
        getRoomInventory(activeEventId),
        getRoomAvailability(activeEventId).catch(() => null),
      ]);
      setContracts(c || []);
      setBlocks(b || []);
      setAvailability(a);
    } catch { setContracts([]); setBlocks([]); setAvailability(null); }
    finally { setLoading(false); }
  }, [activeEventId]);

  useEffect(() => { load(); }, [load]);

  // Global lookups — the Add forms pick from these. Hotels here are ALL hotels
  // (that's the point of adding a contract); the booking form sees only the
  // contracted ones.
  useEffect(() => {
    getHotels().then((h) => setHotels(h || [])).catch(() => setHotels([]));
    getRoomTypes().then((r) => setRoomTypes(r || [])).catch(() => setRoomTypes([]));
  }, []);

  const contractedHotelIds = useMemo(() => new Set(contracts.map((c) => c.hotelId)), [contracts]);

  const visibleBlocks = useMemo(
    () => (roomsHotel ? blocks.filter((b) => b.hotelId === roomsHotel) : blocks),
    [blocks, roomsHotel],
  );

  // Months the availability axis actually covers — the filter's options.
  const months = useMemo(() => monthsOf(availability), [availability]);

  // Availability needs a hotel picked; default to the first contract rather than
  // showing an empty grid on arrival. Only while the grid is showing, so clearing
  // the filter on the blocks list isn't undone a render later.
  useEffect(() => {
    if (roomsMode === 'grid' && !roomsHotel && contracts.length) setRoomsHotel(contracts[0].hotelId);
  }, [contracts, roomsHotel, roomsMode]);

  // Default to the month in view today when the event covers it, else the first.
  useEffect(() => {
    if (!months.length) { setRoomsMonth(''); return; }
    if (months.includes(roomsMonth)) return;
    const now = new Date().toISOString().slice(0, 7);
    setRoomsMonth(months.includes(now) ? now : months[0]);
  }, [months, roomsMonth]);

  const monthLabel = (m) => {
    const [y, mm] = m.split('-');
    return new Date(Number(y), Number(mm) - 1, 1)
      .toLocaleDateString(isAr ? 'ar' : 'en-GB', { month: 'long', year: 'numeric' });
  };

  // Nights already booked for a block's hotel + room type, over its own window.
  // The peak is what bounds an edit: Total has to clear the worst night, not the
  // average one. Read off the availability response, which is refetched with the
  // blocks, so it can never disagree with the grid.
  const bookedPeakFor = useCallback((row) => {
    if (!row) return 0;
    const s = (availability?.series || []).find(
      (x) => x.hotelId === row.hotelId && x.roomTypeId === row.roomTypeId,
    );
    if (!s) return 0;
    return (s.nights || [])
      .filter((n) => n.date >= row.fromDate && n.date <= row.toDate)
      .reduce((max, n) => Math.max(max, n.booked), 0);
  }, [availability]);

  // The block a grid cell writes to: one room type, one night, the hotel in
  // view. Editable only when exactly ONE block covers that night — overlapping
  // blocks add up server-side (Held()), so the cell's number is a sum and there
  // is no single count to write it back to. Those nights (and nights nothing
  // covers) stay read-only; the Room Blocks list edits them one by one.
  const blockAt = useCallback((roomTypeId, date) => {
    const hits = blocks.filter((x) => x.hotelId === roomsHotel && x.roomTypeId === roomTypeId
      && x.fromDate <= date && date <= x.toDate);
    return hits.length === 1 ? hits[0] : null;
  }, [blocks, roomsHotel]);

  // One night, not the whole block: the server splits the block around that
  // night so its neighbours keep their count. The block list therefore changes
  // shape on every such edit, which is why this reloads rather than patching
  // state.
  const saveGridNight = useCallback(async (block, date, roomCount) => {
    try {
      await setRoomInventoryNight(activeEventId, block.id, { date, roomCount });
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the room block');
      throw err;   // keeps the cell open on the bad value
    }
    toast.success(isAr ? 'تم التحديث' : 'Rooms updated');
    await load();
  }, [activeEventId, isAr, load]);

  // ── Contracts ──────────────────────────────────────────────────────────────

  function openContract(row) {
    setErrors({});
    setContractModal({
      editing: row || null,
      form: row ? { hotelId: row.hotelId, notes: row.notes || '' } : { ...EMPTY_CONTRACT },
    });
  }

  async function saveContract() {
    const { editing, form } = contractModal;
    if (!editing && !form.hotelId) {
      setErrors({ hotelId: isAr ? 'الفندق مطلوب' : 'Hotel is required' });
      return;
    }

    setSaving(true);
    try {
      const body = { notes: form.notes.trim() || null };
      if (editing) await updateHotelContract(activeEventId, editing.id, body);
      else await createHotelContract(activeEventId, { ...body, hotelId: form.hotelId });
      toast.success(editing ? (isAr ? 'تم التحديث' : 'Contract updated') : (isAr ? 'تمت الإضافة' : 'Contract added'));
      setContractModal(null);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the contract');
    } finally {
      setSaving(false);
    }
  }

  async function removeContract(row) {
    setBusyId(row.id);
    try {
      await deleteHotelContract(activeEventId, row.id);
      toast.success(isAr ? 'تم الحذف' : 'Contract deleted');
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the contract');
    } finally {
      setBusyId(null);
    }
  }

  // ── Room blocks ────────────────────────────────────────────────────────────

  function openBlock(row) {
    setErrors({});
    setBlockModal({
      editing: row || null,
      form: row
        ? {
            contractId: row.contractId, roomTypeId: row.roomTypeId,
            roomCount: String(row.roomCount ?? ''), fromDate: row.fromDate || '',
            toDate: row.toDate || '', notes: row.notes || '',
          }
        // A single contract is the overwhelmingly common case — preselect it.
        : { ...EMPTY_BLOCK, contractId: contracts.length === 1 ? contracts[0].id : '' },
    });
  }

  async function saveBlock() {
    const { editing, form } = blockModal;
    const errs = {};
    if (!editing && !form.contractId) errs.contractId = isAr ? 'الفندق مطلوب' : 'Hotel is required';
    if (!form.roomTypeId) errs.roomTypeId = isAr ? 'نوع الغرفة مطلوب' : 'Room type is required';
    if (!(Number(form.roomCount) > 0)) errs.roomCount = isAr ? 'يجب أن يكون أكبر من صفر' : 'Must be greater than zero';
    // Caught here as well as on the server (FindBreachAsync), because the message
    // is far more useful next to the field than as a toast after a round trip.
    if (editing) {
      const booked = bookedPeakFor(editing);
      if (!errs.roomCount && Number(form.roomCount) < booked) {
        errs.roomCount = isAr
          ? `${booked} غرفة محجوزة بالفعل — لا يمكن أن يقل الإجمالي عن ذلك`
          : `${booked} room(s) are already booked — Total can't be lower than that`;
      }
    }
    if (!form.fromDate) errs.fromDate = isAr ? 'أول ليلة مطلوبة' : 'First night is required';
    if (!form.toDate) errs.toDate = isAr ? 'آخر ليلة مطلوبة' : 'Last night is required';
    if (form.fromDate && form.toDate && form.toDate < form.fromDate)
      errs.toDate = isAr ? 'آخر ليلة قبل أول ليلة' : 'The last night is before the first';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const body = {
        roomTypeId: form.roomTypeId,
        roomCount: Number(form.roomCount),
        fromDate: form.fromDate,
        toDate: form.toDate,
        notes: form.notes.trim() || null,
      };
      if (editing) await updateRoomInventory(activeEventId, editing.id, body);
      else await createRoomInventory(activeEventId, { ...body, contractId: form.contractId });
      toast.success(editing ? (isAr ? 'تم التحديث' : 'Rooms updated') : (isAr ? 'تمت الإضافة' : 'Rooms added'));
      setBlockModal(null);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the room block');
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(row) {
    setBusyId(row.id);
    try {
      await deleteRoomInventory(activeEventId, row.id);
      toast.success(isAr ? 'تم الحذف' : 'Room block deleted');
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the room block');
    } finally {
      setBusyId(null);
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const contractColumns = useMemo(() => {
    const cols = [
      {
        id: 'hotelName', header: isAr ? 'الفندق' : 'Hotel', accessorKey: 'hotelName',
        cell: ({ row: { original: r } }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {r.hotelImageUrl
              ? <img src={r.hotelImageUrl} alt="" style={{ width: 40, height: 28, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
              : <div style={{ width: 40, height: 28, borderRadius: 5, flexShrink: 0, background: 'var(--surface-soft-3)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="hotel" size={13} style={{ color: 'var(--ink-faint)' }} />
                </div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.hotelName || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.hotelAddress || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'inventoryCount', header: isAr ? 'الكتل' : 'Blocks', accessorKey: 'inventoryCount', size: 90,
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() ?? 0}</span>,
      },
      {
        id: 'totalRooms', header: isAr ? 'الغرف' : 'Rooms', accessorKey: 'totalRooms', size: 90,
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() ?? 0}</span>,
      },
      {
        id: 'notes', header: isAr ? 'ملاحظات' : 'Notes', accessorKey: 'notes',
        cell: ({ getValue }) => <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{getValue() || '—'}</span>,
      },
    ];
    if (canManage) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu items={[
            { label: isAr ? 'إضافة غرف' : 'Add Rooms', icon: 'plus',
              onClick: () => { setTab('inventory'); setErrors({}); setBlockModal({ editing: null, form: { ...EMPTY_BLOCK, contractId: r.id } }); } },
            { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => openContract(r) },
            { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true,
              disabled: busyId === r.id, onClick: () => removeContract(r) },
          ]} />
        ),
      });
    }
    return cols;
  }, [isAr, canManage, busyId, contracts]);

  const blockColumns = useMemo(() => {
    const cols = [
      {
        id: 'hotelName', header: isAr ? 'الفندق' : 'Hotel', accessorKey: 'hotelName',
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontWeight: 600 }}>{getValue() || '—'}</span>,
      },
      {
        id: 'roomTypeName', header: isAr ? 'نوع الغرفة' : 'Room Type', accessorKey: 'roomTypeName',
        cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() || '—'}</span>,
      },
      {
        id: 'roomCount', header: isAr ? 'الغرف' : 'Rooms', accessorKey: 'roomCount', size: 80,
        cell: ({ getValue }) => <span style={{ fontSize: 13, fontWeight: 600 }}>{getValue() ?? 0}</span>,
      },
      {
        id: 'window', header: isAr ? 'الليالي' : 'Nights', accessorKey: 'fromDate',
        cell: ({ row: { original: r } }) => (
          <div>
            <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', direction: 'ltr' }}>{fmtDate(r.fromDate)} → {fmtDate(r.toDate)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
              {r.nights} {isAr ? 'ليلة' : r.nights === 1 ? 'night' : 'nights'}
            </div>
          </div>
        ),
      },
      {
        id: 'notes', header: isAr ? 'ملاحظات' : 'Notes', accessorKey: 'notes',
        cell: ({ getValue }) => <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{getValue() || '—'}</span>,
      },
    ];
    if (canManage) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu items={[
            { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => openBlock(r) },
            { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true,
              disabled: busyId === r.id, onClick: () => removeBlock(r) },
          ]} />
        ),
      });
    }
    return cols;
  }, [isAr, canManage, busyId]);

  const onContracts = tab === 'contracts';

  function handleExport() {
    if (onContracts) {
      const headers = [
        isAr ? 'الفندق' : 'Hotel', isAr ? 'العنوان' : 'Address',
        isAr ? 'الكتل' : 'Blocks', isAr ? 'الغرف' : 'Rooms', isAr ? 'ملاحظات' : 'Notes',
      ];
      const rows = contracts.map((r) => [r.hotelName, r.hotelAddress, r.inventoryCount ?? 0, r.totalRooms ?? 0, r.notes]);
      downloadCsv('hotel-contracts.csv', toCsv(headers, rows));
    } else {
      const headers = [
        isAr ? 'الفندق' : 'Hotel', isAr ? 'نوع الغرفة' : 'Room Type', isAr ? 'الغرف' : 'Rooms',
        isAr ? 'من' : 'From', isAr ? 'إلى' : 'To', isAr ? 'الليالي' : 'Nights', isAr ? 'ملاحظات' : 'Notes',
      ];
      const rows = visibleBlocks.map((r) => [r.hotelName, r.roomTypeName, r.roomCount ?? 0, r.fromDate, r.toDate, r.nights, r.notes]);
      downloadCsv('room-inventory.csv', toCsv(headers, rows));
    }
  }

  const setCF = (k, v) => {
    setContractModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };
  const setBF = (k, v) => {
    setBlockModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAr ? 'مخزون الإقامة' : 'Inventory'}</h1>
          <div className="page-sub">
            {isAr
              ? 'عقود الفنادق لهذه الفعالية والغرف المحجوزة لكل ليلة'
              : "Hotel contracts for this event, and the rooms held for each night"}
          </div>
        </div>
        {activeEventId && (
          <div className="page-actions">
            <button className="btn" onClick={handleExport}>
              <Icon name="download" size={14} /> {isAr ? 'تصدير' : 'Export'}
            </button>
            {canManage && (onContracts ? (
              <button className="btn primary" onClick={() => openContract(null)}>
                <Icon name="plus" size={14} /> {isAr ? 'إضافة عقد' : 'Add Contract'}
              </button>
            ) : (
              <button className="btn primary" onClick={() => openBlock(null)} disabled={!contracts.length}>
                <Icon name="plus" size={14} /> {isAr ? 'إضافة غرف' : 'Add Rooms'}
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
        <>
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${onContracts ? ' active' : ''}`} onClick={() => setTab('contracts')}>
              {isAr ? 'العقود' : 'Contracts'}
            </button>
            <button className={`tab${!onContracts ? ' active' : ''}`} onClick={() => setTab('inventory')}>
              {isAr ? 'الغرف' : 'Rooms'}
            </button>
          </div>

          {/* Blocks hang off a contract, so there is nothing to add until one exists. */}
          {!onContracts && !contracts.length && !loading && (
            <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 10, fontSize: 13, color: '#e0c47e',
              background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)' }}>
              <Icon name="alert" size={14} />{' '}
              {isAr ? 'أضف عقد فندق أولاً' : 'Add a hotel contract first'}
            </div>
          )}

          {/* Availability / blocks toggle — same data, two questions — plus the
              hotel filter, which narrows whichever of the two is showing. */}
          {!onContracts && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { key: 'grid', label: isAr ? 'التوفّر' : 'Availability', icon: 'meetings' },
                { key: 'list', label: isAr ? 'الكتل' : 'Room Blocks', icon: 'reports' },
              ].map((m) => (
                <button key={m.key} className={`btn${roomsMode === m.key ? ' primary' : ''}`}
                  style={{ fontSize: 12 }} onClick={() => setRoomsMode(m.key)}>
                  <Icon name={m.icon} size={13} /> {m.label}
                </button>
              ))}
              {/* Availability is per hotel per month, so neither filter clears to
                  "everything" — the grid has nothing sensible to show without them. */}
              <div style={{ minWidth: 200, marginInlineStart: 'auto' }}>
                <Select
                  value={roomsHotel}
                  onChange={(v) => setRoomsHotel(v || '')}
                  // Only contracted hotels can hold rooms, so that's the whole list.
                  options={contracts.map((c) => ({ value: c.hotelId, label: c.hotelName }))}
                  placeholder={isAr ? '— الفندق —' : '— Hotel —'}
                  // The blocks LIST is still fine unfiltered — it's one row per
                  // block, not a column sum — so only the grid pins it.
                  isClearable={roomsMode === 'list'}
                />
              </div>
              {roomsMode === 'grid' && (
                <div style={{ minWidth: 170 }}>
                  <Select
                    value={roomsMonth}
                    onChange={(v) => setRoomsMonth(v || '')}
                    options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
                    placeholder={isAr ? '— الشهر —' : '— Month —'}
                    isDisabled={!months.length}
                  />
                </div>
              )}
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            {!onContracts && roomsMode === 'grid' ? (
              <RoomAvailabilityGrid data={availability} loading={loading}
                hotelId={roomsHotel} month={roomsMonth} isAr={isAr}
                blockAt={canManage ? blockAt : null}
                onSaveNight={canManage ? saveGridNight : null} />
            ) : (
              <DataTable
                columns={onContracts ? contractColumns : blockColumns}
                data={onContracts ? contracts : visibleBlocks}
                loading={loading}
                showSearch
                pageSize={10}
                searchPlaceholder={onContracts
                  ? (isAr ? 'بحث عن فندق…' : 'Search hotels…')
                  : (isAr ? 'بحث…' : 'Search rooms…')}
                emptyText={onContracts
                  ? (isAr ? 'لا توجد عقود بعد' : 'No hotel contracts yet')
                  : roomsHotel
                    ? (isAr ? 'لا توجد غرف محجوزة في هذا الفندق' : 'No rooms held at this hotel')
                    : (isAr ? 'لا توجد غرف محجوزة بعد' : 'No rooms held yet')}
              />
            )}
          </div>
        </>
      )}

      {/* ── Contract modal ── */}
      <Modal
        open={!!contractModal}
        onClose={() => setContractModal(null)}
        title={contractModal?.editing
          ? (isAr ? 'تعديل العقد' : 'Edit Contract')
          : (isAr ? 'إضافة عقد فندق' : 'Add Hotel Contract')}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setContractModal(null)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn primary" onClick={saveContract} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        {contractModal && (
          <>
            <div>
              <label style={labelStyle}>{isAr ? 'الفندق' : 'Hotel'} *</label>
              <Select
                value={contractModal.form.hotelId}
                onChange={(v) => setCF('hotelId', v || '')}
                // Already-contracted hotels are filtered out rather than rejected
                // on save; on edit the hotel is fixed, so the dropdown is disabled.
                options={hotels
                  .filter((h) => contractModal.editing || !contractedHotelIds.has(h.id))
                  .map((h) => ({ value: h.id, label: h.name }))}
                placeholder={isAr ? '— اختر —' : '— Select —'}
                isDisabled={!!contractModal.editing}
              />
              {errors.hotelId && <div style={errText}>{errors.hotelId}</div>}
              {contractModal.editing && (
                <div style={hintStyle}>
                  {isAr
                    ? 'لا يمكن تغيير الفندق — احذف العقد وأضفه من جديد'
                    : "The hotel can't be changed — delete the contract and add it again"}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                value={contractModal.form.notes} onChange={(e) => setCF('notes', e.target.value)} />
              <div style={hintStyle}>{isAr ? 'اختياري — رقم العقد، الشروط…' : 'Optional — contract reference, terms…'}</div>
            </div>
          </>
        )}
      </Modal>

      {/* ── Room block modal ── */}
      <Modal
        open={!!blockModal}
        onClose={() => setBlockModal(null)}
        title={blockModal?.editing
          ? (isAr ? 'تعديل الغرف' : 'Edit Rooms')
          : (isAr ? 'إضافة غرف' : 'Add Rooms')}
        width={460}
        footer={
          <>
            <button className="btn" onClick={() => setBlockModal(null)} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="btn primary" onClick={saveBlock} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </>
        }
      >
        {blockModal && (
          <>
            <div>
              <label style={labelStyle}>{isAr ? 'الفندق' : 'Hotel'} *</label>
              <Select
                value={blockModal.form.contractId}
                onChange={(v) => setBF('contractId', v || '')}
                options={contracts.map((c) => ({ value: c.id, label: c.hotelName }))}
                placeholder={isAr ? '— اختر —' : '— Select —'}
                isDisabled={!!blockModal.editing}
              />
              {errors.contractId && <div style={errText}>{errors.contractId}</div>}
            </div>

            <div>
              <label style={labelStyle}>{isAr ? 'نوع الغرفة' : 'Room Type'} *</label>
              <Select
                value={blockModal.form.roomTypeId}
                onChange={(v) => setBF('roomTypeId', v || '')}
                options={roomTypes.map((r) => ({ value: r.id, label: r.name }))}
                placeholder={isAr ? '— اختر —' : '— Select —'}
              />
              {errors.roomTypeId && <div style={errText}>{errors.roomTypeId}</div>}
            </div>

            {/* Total / Booked / Available. Booked is the PEAK night in this block's
                window — Total has to clear the worst night, not the average one —
                and it is read-only because it counts real guest stays. Available is
                the same number as Total from the other side, so editing either one
                moves the other; only Total is actually stored (RoomCount). */}
            {(() => {
              const booked = blockModal.editing ? bookedPeakFor(blockModal.editing) : 0;
              const total = blockModal.form.roomCount === '' ? '' : Number(blockModal.form.roomCount);
              const available = total === '' ? '' : total - booked;
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>{isAr ? 'الإجمالي' : 'Total'} *</label>
                      <input type="number" min={Math.max(1, booked)}
                        style={errors.roomCount ? errorStyle : inputStyle}
                        value={blockModal.form.roomCount}
                        onChange={(e) => setBF('roomCount', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>{isAr ? 'محجوز' : 'Booked'}</label>
                      <input type="number" readOnly disabled value={booked}
                        style={{ ...inputStyle, color: 'var(--ink-mute)', cursor: 'not-allowed' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>{isAr ? 'متاح' : 'Available'}</label>
                      <input type="number" min="0"
                        style={errors.roomCount ? errorStyle : inputStyle}
                        value={available}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBF('roomCount', v === '' ? '' : String(booked + Number(v)));
                        }} />
                    </div>
                  </div>
                  <div style={errors.roomCount ? errText : hintStyle}>
                    {errors.roomCount || (booked > 0
                      ? (isAr
                        ? `لا يمكن أن يقل الإجمالي عن ${booked} — أعلى ليلة محجوزة في هذه الفترة`
                        : `Total can't go below ${booked} — the busiest night already booked in this window`)
                      : (isAr
                        ? 'كم غرفة من هذا النوع محجوزة لكل ليلة'
                        : 'How many rooms of this type are held, per night'))}
                  </div>
                </>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>{isAr ? 'أول ليلة' : 'First Night'} *</label>
                <DateField value={blockModal.form.fromDate} onChange={(v) => setBF('fromDate', v || '')}
                  maxDate={blockModal.form.toDate || undefined} placeholder="DD-MM-YYYY" />
                {errors.fromDate && <div style={errText}>{errors.fromDate}</div>}
              </div>
              <div>
                <label style={labelStyle}>{isAr ? 'آخر ليلة' : 'Last Night'} *</label>
                <DateField value={blockModal.form.toDate} onChange={(v) => setBF('toDate', v || '')}
                  minDate={blockModal.form.fromDate || undefined} placeholder="DD-MM-YYYY" />
                {errors.toDate && <div style={errText}>{errors.toDate}</div>}
              </div>
            </div>
            {/* Nights, not check-in/check-out: a guest checking out on the 8th
                slept the 7th, so a block through the 7th covers them. */}
            <div style={hintStyle}>
              {isAr
                ? 'ليالٍ شاملة الطرفين — ضيف يسجّل خروجه صباح اليوم التالي لآخر ليلة'
                : 'Inclusive nights — a guest checks out the morning after the last night'}
            </div>

            <div>
              <label style={labelStyle}>{isAr ? 'ملاحظات' : 'Notes'}</label>
              <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                value={blockModal.form.notes} onChange={(e) => setBF('notes', e.target.value)} />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
