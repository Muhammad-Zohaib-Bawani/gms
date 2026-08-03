// The conversation transcript.
//
// Pulled out of SupportChatView so the message rendering rules live in one
// place. The list previously drew every message as an identical standalone
// bubble with the sender's name repeated above each one; a burst of five
// replies read as five separate conversations. Consecutive messages from the
// same side are now grouped: the name and avatar appear once for the run, the
// spacing tightens inside it, and only the last bubble of a run gets the tail.
import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../components/Icons';
import { Avatar } from '../../components/UI';

// Messages closer together than this from the same sender belong to one run.
const GROUP_WINDOW_MS = 4 * 60 * 1000;

function isSameRun(prev, m) {
  if (!prev) return false;
  if ((prev.isMine === true) !== (m.isMine === true)) return false;
  if (prev.senderName !== m.senderName) return false;
  const gap = new Date(m.sentAt) - new Date(prev.sentAt);
  return Number.isFinite(gap) && gap >= 0 && gap < GROUP_WINDOW_MS;
}

function Bubble({ m, mine, tail, plainBody, isAr }) {
  // Radius communicates the run: only the closing bubble is notched towards
  // its sender, so a group reads as one block of speech.
  const radius = mine
    ? (tail ? '14px 14px 3px 14px' : '14px 14px 14px 14px')
    : (tail ? '14px 14px 14px 3px' : '14px 14px 14px 14px');

  return (
    <div style={{
      padding: '9px 13px',
      borderRadius: radius,
      background: mine ? 'var(--accent)' : 'var(--surface-soft-3)',
      color: mine ? '#fff' : 'var(--ink)',
      fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word',
    }}>
      {/* Plain text both ways — bodies are no longer HTML (the composer sends
          text), so nothing is ever set as innerHTML. React escapes the string;
          pre-wrap keeps the line breaks. */}
      {m.body && <div style={{ whiteSpace: 'pre-wrap' }}>{plainBody(m.body)}</div>}

      {m.attachmentUrl && (
        m.attachmentType?.startsWith('image') ? (
          <a href={m.attachmentUrl} target="_blank" rel="noreferrer"
            style={{ display: 'block', marginTop: m.body ? 8 : 0 }}>
            <img src={m.attachmentUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
          </a>
        ) : (
          <a href={m.attachmentUrl} target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: m.body ? 8 : 0,
              color: 'inherit', textDecoration: 'underline', fontSize: 12,
            }}>
            <Icon name="doc" size={13} /> {isAr ? 'مرفق' : 'Attachment'}
          </a>
        )
      )}
    </div>
  );
}

export default function MessageList({
  messages, isAr, STR,
  plainBody, sameDay, dayLabel, timeOfDay, initialsFromName,
  guestName,
}) {
  return (
    <>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const mine = m.isMine === true;

        const showDivider = !prev || !sameDay(prev.sentAt, m.sentAt);
        // A day divider always starts a fresh run, even if the two messages are
        // minutes apart across midnight.
        const runStart = showDivider || !isSameRun(prev, m);
        const runEnd = !next || !isSameRun(m, next) || !sameDay(m.sentAt, next.sentAt);

        return (
          <React.Fragment key={m.id}>
            {showDivider && (
              <div style={{
                textAlign: 'center', margin: '16px 0 12px', fontSize: 11,
                color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {dayLabel(m.sentAt, isAr)}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 7,
                // Tight inside a run, roomy between runs — the spacing is what
                // makes the grouping legible.
                marginBottom: runEnd ? 10 : 2,
              }}
            >
              {/* Incoming runs carry one avatar, on the closing bubble, so the
                  column stays aligned without repeating the face per message. */}
              {!mine && (
                <div style={{ width: 26, flexShrink: 0 }}>
                  {runEnd && (
                    <Avatar initials={initialsFromName(m.senderName || guestName)} size={26} />
                  )}
                </div>
              )}

              <div style={{
                maxWidth: '72%', display: 'flex', flexDirection: 'column',
                alignItems: mine ? 'flex-end' : 'flex-start',
              }}>
                {runStart && m.senderName && (
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 3 }}>
                    {m.senderName}
                  </div>
                )}

                <Bubble m={m} mine={mine} tail={runEnd} plainBody={plainBody} isAr={isAr} />

                {/* One timestamp per run rather than one per message — the
                    per-message stamps were noise inside a burst. */}
                {runEnd && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 3,
                    fontSize: 10.5, color: 'var(--ink-faint)',
                  }}>
                    {timeOfDay(m.sentAt, isAr)}
                    {mine && (
                      <span title={m.isRead ? STR.read : STR.sent}
                        style={{ display: 'inline-flex', color: m.isRead ? 'var(--accent)' : 'var(--ink-faint)' }}>
                        <Icon name="checkDouble" size={12} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </React.Fragment>
        );
      })}
    </>
  );
}
