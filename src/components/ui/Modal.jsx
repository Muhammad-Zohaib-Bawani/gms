import React, { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../Icons';
import { originOffset, prefersReducedMotion } from '../../lib/clickOrigin';

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(24, 8, 14, 0.42)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  zIndex: 1000,
};

const contentBase = {
  position: 'fixed', inset: 0, margin: 'auto',
  maxWidth: '92vw',
  zIndex: 1001,
  display: 'flex', flexDirection: 'column',
  border: '1px solid var(--glass-border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-xl)',
  outline: 'none',
};

const headerStyle = {
  padding: '18px 22px',
  borderBottom: '1px solid var(--glass-border)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  flexShrink: 0,
};

const footerStyle = {
  padding: '14px 22px',
  borderTop: '1px solid var(--glass-border)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  flexShrink: 0,
};

// Springy but short. A dialog that overshoots much reads as toy-like.
const EASE = [0.16, 1, 0.3, 1];

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  height,
  maxHeight = '88vh',
  children,
  footer,
}) {
  // Sampled once per open. Reading it during render on every frame would let a
  // later press (on something inside the dialog) drag the exit animation off
  // towards that new control instead of back to the button that opened it.
  const originRef = useRef({ x: 0, y: 0 });
  const reduced = prefersReducedMotion();
  if (open && !originRef.current.sampled) {
    originRef.current = { ...(reduced ? { x: 0, y: 0 } : originOffset()), sampled: true };
  }
  if (!open && originRef.current.sampled) {
    originRef.current = { ...originRef.current, sampled: false };
  }
  const { x, y } = originRef.current;

  return (
    // forceMount hands presence to AnimatePresence — without it Radix rips the
    // content out of the DOM the instant `open` flips and the exit never plays.
    <Dialog.Root open={open} onOpenChange={o => !o && onClose?.()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                style={overlayStyle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'linear' }}
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              className="modal-solid modal-anim-js"
              onInteractOutside={e => e.preventDefault()}
              onFocusOutside={e => e.preventDefault()}
            >
              <motion.div
                style={{ ...contentBase, width, height: height || 'fit-content', maxHeight }}
                // Grows out of the control that opened it and collapses back
                // into it. x/y are additive to the inset/margin centring, so
                // the dialog still lands dead centre.
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, x, y }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, x, y }}
                transition={{ duration: reduced ? 0.12 : 0.26, ease: EASE }}
              >
                {title && (
                  <div style={headerStyle}>
                    <div>
                      <Dialog.Title style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</Dialog.Title>
                      {subtitle && (
                        <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3 }}>
                          {subtitle}
                        </Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close asChild>
                      <button className="icon-btn" style={{ flexShrink: 0, marginTop: 2 }}>
                        <Icon name="close" size={14}/>
                      </button>
                    </Dialog.Close>
                  </div>
                )}

                <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {children}
                </div>

                {footer && <div style={footerStyle}>{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
