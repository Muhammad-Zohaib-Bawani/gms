import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Icon } from '../Icons';

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(3px)',
  zIndex: 1000,
};

const contentBase = {
  position: 'fixed', inset: 0, margin: 'auto',
  maxWidth: '92vw',
  zIndex: 1001,
  display: 'flex', flexDirection: 'column',
  background: 'var(--glass-bg, rgba(10,28,36,0.92))',
  backdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 16,
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
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
  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
          style={{ ...contentBase, width, ...(height ? { height, maxHeight } : { maxHeight }) }}
          onInteractOutside={e => e.preventDefault()}
          onFocusOutside={e => e.preventDefault()}
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

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {children}
          </div>

          {footer && <div style={footerStyle}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
