import React from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'sonner';

// Toasts have to sit above every dialog, and a z-index alone can't get them there.
//
// `#root` is `position: relative; z-index: 1` (styles/qoc-revamp.css) so the
// fixed `.bg-scene` at z-index -1 stays behind the app. That makes #root a
// stacking CONTEXT: anything inside it is confined to z-index 1 relative to the
// page, however large its own z-index is. Radix (ui/Modal, GuestModal) portals its
// overlay and content to document.body instead — outside #root, at z-index 1000+ —
// so a modal paints above the entire #root subtree, toaster included. The toast was
// rendering, just underneath the overlay's dim and blur.
//
// Portalling the toaster to document.body makes it a sibling of those overlays, so
// its z-index competes with them directly and wins.
//
// One toaster, not a second one per modal: sonner's store is global, so every
// mounted <Toaster> renders every toast — a modal-only instance would show each
// message twice while the modal is open.
const TOAST_Z = 100000;

export default function AppToaster() {
  return createPortal(
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme="dark"
      // pointerEvents: Radix's dialogs set `pointer-events: none` on <body> while
      // open and re-enable it only on their own layer. Without this the toast would
      // be visible but its close button dead for as long as a modal is up.
      style={{ zIndex: TOAST_Z, pointerEvents: 'auto' }}
    />,
    document.body,
  );
}
