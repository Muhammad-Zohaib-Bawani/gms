import { Icon } from "../../../../components/Icons";

// Footer: Back/Cancel on the left, Next or Save on the right (Save only on
// the wizard's last step). Moved verbatim out of GuestModal.jsx's inline JSX.
export default function GuestModalFooter({
  showWizard,
  stepPos,
  isLastStep,
  isEdit,
  templateId,
  saving,
  onBack,
  onNext,
  onSave,
  t,
  commonCancel,
}) {
  return (
    <div className="guest-modal-footer">
      <button className="btn" onClick={onBack}>
        {showWizard && stepPos > 0 ? (
          <>
            <Icon name="arrowLeft" size={13} /> {t.footer.back}
          </>
        ) : (
          commonCancel
        )}
      </button>
      {showWizard && !isLastStep && (
        <button className="btn primary" onClick={onNext}>
          {t.footer.next} <Icon name="arrow" size={13} />
        </button>
      )}
      {showWizard && isLastStep && (
        <button className="btn primary" onClick={onSave} disabled={saving}>
          <Icon name="check" size={13} />
          {saving
            ? t.footer.saving
            : isEdit
              ? t.footer.saveChanges
              : templateId
                ? t.footer.addSendInvite
                : t.footer.addGuest}
        </button>
      )}
    </div>
  );
}
