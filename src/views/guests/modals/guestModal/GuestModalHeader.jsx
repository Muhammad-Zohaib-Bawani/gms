import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "../../../../components/Icons";

// Dialog header: title (varies by isEdit/mode) + close button. Moved verbatim
// out of GuestModal.jsx's inline JSX.
export default function GuestModalHeader({ isEdit, mode, guest, showWizard, t }) {
  return (
    <div
      className="guest-modal-header"
      style={{
        // The divider belongs to whichever row is last before the body. With
        // the wizard showing that's the step row; without it (Import /
        // Existing Guest) the title is last and carries it here.
        borderBottom: showWizard ? "none" : "1px solid var(--glass-border)",
      }}
    >
      <div>
        <Dialog.Title className="guest-modal-title">
          {/* Names the specific flow, not just "Add Guest" — with the mode
              tabs gone this title is the only thing telling the user which
              of the three they picked. */}
          {isEdit
            ? t.header.editGuest
            : mode === "existing"
              ? t.header.addExisting
              : mode === "import"
                ? t.header.importCsv
                : t.header.addNew}
          {isEdit && (
            <span className="guest-modal-edit-name">{guest.fullName}</span>
          )}
        </Dialog.Title>
      </div>
      <Dialog.Close asChild>
        <button className="icon-btn guest-modal-close-btn">
          <Icon name="close" size={14} />
        </button>
      </Dialog.Close>
    </div>
  );
}
