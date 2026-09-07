import { Icon } from "../../../../components/Icons";
import ServiceAccordion from "../../ServiceAccordion";

// STEP 3 — Services from the guest's level. Moved verbatim out of
// GuestModal.jsx's inline JSX.
export default function GuestModalStep3Services({
  selectedLevel,
  wizardSlots,
  pendingServices,
  setPendingServices,
  travel,
  setTravel,
  travelLookups,
  isFixedEvent,
  isEdit,
  lang,
  activeEventId,
  eventStartDate,
  eventEndDate,
  dateWindowMin,
  dateWindowMax,
  t,
}) {
  return (
    <>
      {!selectedLevel ? (
        <div className="alert alert-info" style={{ fontSize: 12.5 }}>
          <Icon name="alert" size={14} />
          <div>{t.step3.pickLevelFirst}</div>
        </div>
      ) : wizardSlots.length === 0 ? (
        <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
          <Icon name="alert" size={14} />
          <div>{t.step3.noServicesAssigned(selectedLevel.name)}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
            {isFixedEvent ? t.step3.fixedHint : t.step3.flexHint}
          </div>

          <ServiceAccordion
            slots={wizardSlots}
            pending={pendingServices}
            onPendingChange={setPendingServices}
            travel={travel}
            onTravelChange={setTravel}
            travelLookups={travelLookups}
            isFixed={isFixedEvent}
            lang={lang}
            eventId={activeEventId}
            eventStart={eventStartDate}
            eventEnd={eventEndDate}
            dateMinDate={dateWindowMin}
            dateMaxDate={dateWindowMax}
            allowAddAnother={false}
            lockOnDone={isEdit}
          />
        </>
      )}
    </>
  );
}
