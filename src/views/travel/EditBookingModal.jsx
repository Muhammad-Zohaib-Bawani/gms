import React from "react";
import { Icon } from "../../components/Icons.jsx";
import Select from "../../components/ui/Select.jsx";
import DateRangePicker from "../../components/ui/DateRangePicker.jsx";
import { addDaysIso, fmtDate } from "../../lib/date.js";
import {
  vehicleLabel,
  driverLabel,
  FlightFields,
  TRANSPORT_MAX_SPAN_HOURS,
} from "../guests/modals/TravelAccordion.jsx";
import "./travel-view.css";

const mapOpts = (arr, labelFn) =>
  (arr || []).map((x) => ({ value: x.id, label: labelFn(x) }));

function Grid2({ children }) {
  return <div className="travel-grid-2">{children}</div>;
}

// Same field set as New Booking / the guest wizard, scoped to just the one
// section (flight/hotel/transfer) being edited.
export default function EditBookingModal({
  editModal,
  isAr,
  STR,
  travelLookups,
  eventMinDate,
  eventMaxDate,
  dateWindowMin,
  dateWindowMax,
  editVehicles,
  editDrivers,
  editRoomTypes,
  editRooms,
  setEditField,
  closeEdit,
  saveEdit,
  savingEdit,
}) {
  if (!editModal) return null;

  const flightStatusOpts = [
    { value: "confirmed", label: isAr ? "مؤكد" : "Confirmed" },
    { value: "pending", label: isAr ? "قيد الانتظار" : "Pending" },
  ];

  return (
    <div className="travel-modal-overlay">
      <div
        className="card glass modal-solid"
        style={{
          width: 720,
          maxWidth: "92vw",
          padding: 0,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--glass-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {/* Opened from a pending row there is nothing to edit yet, so the
                  title has to say Add — the field set is identical either way. */}
              {editModal.isNew
                ? (editModal.type === "flight"
                  ? (isAr ? "إضافة رحلة" : "Add Flight")
                  : editModal.type === "hotel"
                    ? (isAr ? "إضافة إقامة" : "Add Accommodation")
                    : (isAr ? "إضافة نقل" : "Add Transfer"))
                : editModal.type === "flight"
                  ? STR.editFlight
                  : editModal.type === "hotel"
                    ? STR.editHotel
                    : STR.editTransfer}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-mute)",
                marginTop: 2,
              }}
            >
              {editModal.guestName}
            </div>
          </div>
          <button className="icon-btn" onClick={closeEdit}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div
          style={{
            padding: "18px 20px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {editModal.loading && (
            <div
              style={{
                textAlign: "center",
                color: "var(--ink-mute)",
                fontSize: 13,
                padding: "20px 0",
              }}
            >
              …
            </div>
          )}

          {/* Same field set as the guest wizard — one shared component, so the
              radio group and the per-leg fields can't drift between the two. */}
          {!editModal.loading && editModal.type === "flight" && (
            <>
              <FlightFields
                flight={editModal.form}
                setFlight={setEditField}
                lookups={travelLookups}
                isAr={isAr}
                eventMinDate={eventMinDate}
                eventMaxDate={eventMaxDate}
              />
              <div>
                <label className="travel-field-label">
                  {isAr ? "حالة الحجز" : "Booking Status"}
                </label>
                <Select
                  value={editModal.form.status}
                  onChange={(v) => setEditField({ status: v })}
                  options={flightStatusOpts}
                  placeholder={isAr ? "— اختر —" : "— Select —"}
                />
              </div>
            </>
          )}

          {!editModal.loading &&
            editModal.type === "hotel" &&
            (() => {
              const f = editModal.form;
              const set = (k, v) => setEditField({ [k]: v });
              return (
                <>
                  <Grid2>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "الفندق" : "Hotel"} *
                      </label>
                      <Select
                        value={f.hotelId}
                        onChange={(v) => set("hotelId", v)}
                        options={mapOpts(
                          travelLookups.hotels,
                          (x) => x.name,
                        )}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                      />
                    </div>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "نوع الغرفة" : "Room Type"}
                        {editRooms.managed ? " *" : ""}
                      </label>
                      <Select
                        value={f.roomTypeId}
                        onChange={(v) => set("roomTypeId", v)}
                        options={mapOpts(editRoomTypes, (x) => x.name)}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                        isClearable={!editRooms.managed}
                      />
                    </div>
                  </Grid2>
                  {/* One calendar instead of two date fields — same range
                    picker the guest wizard's accommodation step uses. Held-room
                    window bounds it and full nights are greyed out; check-out is
                    the morning after the last night slept, so it may sit one
                    day past the window (handled by endMaxFor, not minDate/maxDate). */}
                  <div>
                    <label className="travel-field-label">
                      {isAr ? "ليالي الإقامة" : "Stay Dates"} *
                    </label>
                    <DateRangePicker
                      mode="date"
                      startValue={f.checkIn}
                      endValue={f.checkOut}
                      onChange={(checkIn, checkOut) => setEditField({ checkIn, checkOut })}
                      minDate={editRooms.window?.min || dateWindowMin}
                      maxDate={editRooms.window?.max || dateWindowMax}
                      excludeDates={editRooms.fullDates}
                      endMaxFor={(s) =>
                        editRooms.firstFullAfter(s) ||
                        (editRooms.window && addDaysIso(editRooms.window.max, 1)) ||
                        dateWindowMax
                      }
                      startLabel={isAr ? "الوصول" : "Check-in"}
                      endLabel={isAr ? "المغادرة" : "Check-out"}
                      startIcon="hotel"
                      endIcon="hotel"
                      title={isAr ? "ليالي الإقامة" : "Stay dates"}
                      hint={isAr
                        ? "الليالي المحجوزة بالكامل مشطوبة. تاريخ المغادرة هو صباح اليوم التالي لآخر ليلة."
                        : "Fully-booked nights are struck through. Check-out is the morning after the last night."}
                      isAr={isAr}
                    />
                  </div>
                  {editRooms.managed && f.checkIn && (
                    <div
                      style={{ fontSize: 11, color: "var(--ink-faint)" }}
                    >
                      {editRooms.availableOn(f.checkIn) === null
                        ? isAr
                          ? "لا غرف محجوزة في هذا التاريخ"
                          : "No rooms held on that date"
                        : isAr
                          ? `${editRooms.availableOn(f.checkIn)} غرفة متاحة ليلة ${fmtDate(f.checkIn)}`
                          : `${editRooms.availableOn(f.checkIn)} room(s) left on the night of ${fmtDate(f.checkIn)}`}
                    </div>
                  )}
                  {/* {grid2(<>
                  <div><label style={lSt}>{isAr ? 'إطلالة الغرفة' : 'Room View'}</label><input style={iSt} value={f.roomView} onChange={e => set('roomView', e.target.value)}/></div>
                  <div><label style={lSt}>{isAr ? 'عدد النزلاء' : 'Guest Count'}</label><input type="number" style={iSt} value={f.guestCount} onChange={e => set('guestCount', e.target.value)}/></div>
                </>)}
                {grid2(<>
                  <div><label style={lSt}>{isAr ? 'اسم الكونسيرج' : 'Concierge Name'}</label><input style={iSt} value={f.conciergeName} onChange={e => set('conciergeName', e.target.value)}/></div>
                  <div><label style={lSt}>{isAr ? 'هاتف الكونسيرج' : 'Concierge Phone'}</label><input style={iSt} value={f.conciergePhone} onChange={e => set('conciergePhone', e.target.value)}/></div>
                </>)} */}
                </>
              );
            })()}

          {!editModal.loading &&
            editModal.type === "transfer" &&
            (() => {
              const f = editModal.form;
              const set = (k, v) => setEditField({ [k]: v });
              return (
                <>
                  <Grid2>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "موقع الاستلام" : "Pickup Location"} *
                      </label>
                      <Select
                        value={f.pickupLocationId}
                        onChange={(v) => set("pickupLocationId", v)}
                        options={mapOpts(
                          travelLookups.locations,
                          (x) => x.address,
                        )}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                      />
                    </div>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "موقع التوصيل" : "Dropoff Location"} *
                      </label>
                      <Select
                        value={f.dropoffLocationId}
                        onChange={(v) => set("dropoffLocationId", v)}
                        options={mapOpts(
                          travelLookups.locations,
                          (x) => x.address,
                        )}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                      />
                    </div>
                  </Grid2>
                  {/* One range calendar + two times, before the vehicle: the
                    list below only offers cars free in that window. */}
                  <div>
                    <label className="travel-field-label">
                      {isAr ? "الاستلام والتوصيل" : "Pickup & Dropoff"} *
                    </label>
                    <DateRangePicker
                      mode="datetime"
                      startValue={f.pickupTime}
                      endValue={f.dropoffTime}
                      onChange={(start, end) => setEditField({ pickupTime: start, dropoffTime: end })}
                      minDate={dateWindowMin}
                      maxDate={dateWindowMax}
                      maxSpanHours={TRANSPORT_MAX_SPAN_HOURS}
                      startLabel={isAr ? "الاستلام" : "Pickup"}
                      endLabel={isAr ? "التوصيل" : "Dropoff"}
                      startIcon="car"
                      endIcon="mapPin"
                      title={isAr ? "مواعيد الاستلام والتوصيل" : "Pickup & dropoff time"}
                      isAr={isAr}
                    />
                  </div>
                  <Grid2>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "المركبة" : "Vehicle"} *
                      </label>
                      <Select
                        value={f.vehicleId}
                        onChange={(v) => set("vehicleId", v)}
                        options={mapOpts(editVehicles, vehicleLabel)}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                      />
                    </div>
                    <div>
                      <label className="travel-field-label">
                        {isAr ? "السائق" : "Driver"}
                      </label>
                      <Select
                        value={f.driverId}
                        onChange={(v) => set("driverId", v)}
                        options={mapOpts(editDrivers, driverLabel)}
                        placeholder={isAr ? "— اختر —" : "— Select —"}
                        isClearable
                      />
                    </div>
                  </Grid2>
                </>
              );
            })()}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--glass-border)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button className="btn" onClick={closeEdit}>
            {STR.cancel}
          </button>
          <button
            className="btn primary"
            onClick={saveEdit}
            disabled={savingEdit || editModal.loading}
          >
            <Icon name="check" size={13} />{" "}
            {savingEdit ? (isAr ? "جارٍ الحفظ…" : "Saving…") : STR.save}
          </button>
        </div>
      </div>
    </div>
  );
}
