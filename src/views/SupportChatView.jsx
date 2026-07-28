// Admin side of guest ↔ support chat. Two-pane inbox: a searchable, paged
// conversation table on the left (one row per guest, latest message inline),
// the open thread + reply composer on the right — the classic split-view
// messaging layout (WhatsApp Web / Intercom), built from the app's existing
// DataTable/Select/Modal-less primitives rather than a new UI kit.
//
// Backend is already live (SupportChatController / SupportChatService) — this
// file is purely the integration + UI. Kept read-only for anyone without
// SupportChat.Manage: they can open and read threads, but the composer and
// close/reopen controls disappear.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { Avatar } from '../components/UI';
import Select from '../components/ui/Select';
import DataTable from '../components/ui/DataTable';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getConversations, getMessages, replyToConversation,
  markConversationRead, closeConversation, reopenConversation,
} from '../api/services/supportChatService';

// Polling cadence for v1 (no realtime client in this frontend yet). Each poll
// site below is commented as the seam to swap for a SignalR subscription to
// the already-mapped /realtimehub "SupportMessageNew" event later.
const CONVERSATIONS_POLL_MS = 15000;
const MESSAGES_POLL_MS = 5000;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_BODY_LENGTH = 4000; // mirrors SupportChatService.MaxBodyLength

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// Compact relative time for the inbox row list: "now" / "12m" / "3h" /
// "Yesterday" / weekday / full date.
function relativeTime(iso, isAr) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return isAr ? 'الآن' : 'now';
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isAr ? `${hours} س` : `${hours}h`;
  const daysDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (daysDiff === 1) return isAr ? 'أمس' : 'Yesterday';
  if (daysDiff < 7) return d.toLocaleDateString(isAr ? 'ar' : 'en-US', { weekday: 'short' });
  return d.toLocaleDateString(isAr ? 'ar' : 'en-US', { day: 'numeric', month: 'short' });
}

function timeOfDay(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(isAr ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

// "Today" / "Yesterday" / full date — used for the divider between days in
// the open thread.
function dayLabel(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const daysDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (daysDiff === 0) return isAr ? 'اليوم' : 'Today';
  if (daysDiff === 1) return isAr ? 'أمس' : 'Yesterday';
  return d.toLocaleDateString(isAr ? 'ar' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function sameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function SupportChatView({ lang }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('SupportChat.Manage');

  const STR = {
    title: isAr ? 'الدعم الفني' : 'Support Chat',
    sub: isAr ? 'محادثات الضيوف مع فريق الدعم' : "Guests' conversations with the support team",
    searchPh: isAr ? 'ابحث بالاسم أو البريد الإلكتروني…' : 'Search by name or email…',
    onlyUnread: isAr ? 'غير مقروءة فقط' : 'Unread only',
    noConversations: isAr ? 'لا توجد محادثات' : 'No conversations',
    pickConversation: isAr ? 'اختر محادثة لعرض الرسائل' : 'Select a conversation to view its messages',
    noMessages: isAr ? 'لا توجد رسائل بعد' : 'No messages yet',
    loadEarlier: isAr ? 'تحميل الرسائل الأقدم' : 'Load earlier messages',
    composerPh: isAr ? 'اكتب ردًا…' : 'Type a reply…',
    send: isAr ? 'إرسال' : 'Send',
    viewOnly: isAr ? 'وصول للعرض فقط — لا يمكنك الرد' : 'View-only access — you cannot reply',
    closed: isAr ? 'مغلقة' : 'Closed',
    open: isAr ? 'مفتوحة' : 'Open',
    close: isAr ? 'إغلاق المحادثة' : 'Close conversation',
    reopen: isAr ? 'إعادة فتح المحادثة' : 'Reopen conversation',
    closedBanner: isAr
      ? 'هذه المحادثة مغلقة. أعد فتحها للرد.'
      : 'This conversation is closed. Reopen it to reply.',
    you: isAr ? 'أنت' : 'You',
    read: isAr ? 'مقروءة' : 'Read',
    sent: isAr ? 'مُرسلة' : 'Sent',
  };

  // ── Conversation list (left pane) — server-paged + searched, same shape as
  // every other paged list in this app (GuestsView, TravelView tabs). ────────
  const [conversations, setConversations] = useState([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convPageIndex, setConvPageIndex] = useState(0);
  const [convPageSize, setConvPageSize] = useState(10);
  const [convLoading, setConvLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | Open | Closed

  const [selectedId, setSelectedId] = useState(null);
  // Conversation ids already auto-marked-read this session — guards against
  // re-firing the /read call on every poll while a thread stays open.
  const markedReadRef = useRef(new Set());

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setConvPageIndex(0); }, [search, onlyUnread, statusFilter, convPageSize]);

  const loadConversations = useCallback(async ({ silent } = {}) => {
    if (!silent) setConvLoading(true);
    try {
      const r = await getConversations({
        pageNumber: convPageIndex + 1,
        pageSize: convPageSize,
        search: search || undefined,
        onlyUnread: onlyUnread || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setConversations(r?.items || []);
      setConvTotal(r?.totalCount ?? 0);
    } catch (err) {
      if (!silent) toast.fromError(err);
    } finally {
      if (!silent) setConvLoading(false);
    }
  }, [convPageIndex, convPageSize, search, onlyUnread, statusFilter]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // TODO(signalR): replace with a subscription to /realtimehub's
  // "SupportMessageNew" event once the admin portal has a hub client — this
  // interval is the whole seam.
  useEffect(() => {
    const t = setInterval(() => loadConversations({ silent: true }), CONVERSATIONS_POLL_MS);
    return () => clearInterval(t);
  }, [loadConversations]);

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

  // ── Open thread (right pane) ───────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagePageSize, setMessagePageSize] = useState(DEFAULT_MESSAGE_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef(null);

  const loadMessages = useCallback(async ({ silent, size } = {}) => {
    if (!selectedId) return;
    if (!silent) setMessagesLoading(true);
    try {
      const r = await getMessages(selectedId, { pageSize: size ?? messagePageSize });
      setMessages(r?.items || []);
      setMessagesTotal(r?.totalCount ?? 0);
    } catch (err) {
      if (!silent) toast.fromError(err);
    } finally {
      if (!silent) setMessagesLoading(false);
      setLoadingOlder(false);
    }
    // messagePageSize IS a real dependency: after "load earlier" raises it, the
    // background poll below must keep requesting the wider window, or it would
    // silently truncate the thread back to 50 and discard the history the
    // admin just loaded. (The poll effect re-subscribes whenever this function
    // reference changes, so bumping the size here correctly restarts the timer.)
  }, [selectedId, messagePageSize]);

  // Reset thread state on conversation change, then load its first page.
  useEffect(() => {
    setMessages([]);
    setMessagesTotal(0);
    setMessagePageSize(DEFAULT_MESSAGE_PAGE_SIZE);
    setDraft('');
    stickToBottomRef.current = true;
    if (selectedId) loadMessages({ size: DEFAULT_MESSAGE_PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // TODO(signalR): same seam as the conversations poll above.
  useEffect(() => {
    if (!selectedId) return undefined;
    const t = setInterval(() => loadMessages({ silent: true }), MESSAGES_POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  // Auto mark-read once per selection when opening a thread with unread guest
  // messages — "open the thread" is the natural admin equivalent of reading it.
  useEffect(() => {
    if (!selectedId || !canManage) return;
    const conv = conversations.find(c => c.id === selectedId);
    if (!conv || conv.unreadCount <= 0) return;
    if (markedReadRef.current.has(selectedId)) return;
    markedReadRef.current.add(selectedId);
    markConversationRead(selectedId)
      .then(() => setConversations(prev => prev.map(c => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))))
      .catch(() => markedReadRef.current.delete(selectedId));
  }, [selectedId, conversations, canManage]);

  // Stick to the bottom on new messages unless the admin has scrolled up to
  // read history — don't yank them back down mid-read.
  useEffect(() => {
    if (!stickToBottomRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function handleThreadScroll(e) {
    const el = e.target;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function selectConversation(conv) {
    setSelectedId(conv.id);
  }

  async function loadOlderMessages() {
    if (loadingOlder || messages.length >= messagesTotal) return;
    setLoadingOlder(true);
    const nextSize = messagePageSize + DEFAULT_MESSAGE_PAGE_SIZE;
    setMessagePageSize(nextSize);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    await loadMessages({ size: nextSize });
    // Keep the viewport anchored on what the admin was reading instead of
    // jumping to the very top once older history is prepended.
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      const msg = await replyToConversation(selectedId, body);
      setMessages(prev => [...prev, msg]);
      setMessagesTotal(t => t + 1);
      setDraft('');
      stickToBottomRef.current = true;
      setConversations(prev => prev.map(c => (c.id === selectedId
        ? { ...c, lastMessagePreview: body.slice(0, 200), lastMessageAt: msg.sentAt, lastMessageFromGuest: false }
        : c)));
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر إرسال الرسالة' : 'Could not send the message');
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function handleToggleStatus() {
    if (!selectedConversation || togglingStatus) return;
    const closing = selectedConversation.status !== 'Closed';
    setTogglingStatus(true);
    try {
      if (closing) await closeConversation(selectedId);
      else await reopenConversation(selectedId);
      setConversations(prev => prev.map(c => (c.id === selectedId ? { ...c, status: closing ? 'Closed' : 'Open' } : c)));
      toast.success(closing ? (isAr ? 'تم إغلاق المحادثة' : 'Conversation closed') : (isAr ? 'تم إعادة فتح المحادثة' : 'Conversation reopened'));
    } catch (err) {
      toast.fromError(err);
    } finally {
      setTogglingStatus(false);
    }
  }

  // ── Conversation list columns ─────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      id: 'guest', header: isAr ? 'الضيف' : 'Guest', enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <Avatar initials={initialsFromName(c.guestName)} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: 128,
                }}>
                  {c.guestName || '—'}
                </span>
                <span
                  title={c.status}
                  style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: c.status === 'Closed' ? 'var(--ink-faint)' : 'var(--accent)',
                  }}
                />
              </div>
              <div style={{
                fontSize: 11, color: 'var(--ink-mute)', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
              }}>
                {c.guestEmail || '—'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'lastMessage', header: isAr ? 'آخر رسالة' : 'Latest Message', enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        const prefix = c.lastMessageFromGuest === false ? `${STR.you}: ` : '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 12.5, color: c.unreadCount > 0 ? 'var(--ink)' : 'var(--ink-mute)',
                fontWeight: c.unreadCount > 0 ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.lastMessagePreview ? `${prefix}${c.lastMessagePreview}` : STR.noMessages}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', flexShrink: 0 }}>
                {relativeTime(c.lastMessageAt, isAr)}
              </span>
            </div>
            {c.unreadCount > 0 && (
              <span style={{
                alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 700, color: '#fff',
                background: 'var(--accent)', borderRadius: 20, padding: '1px 7px',
              }}>
                {c.unreadCount}
              </span>
            )}
          </div>
        );
      },
    },
  ], [isAr, STR.you, STR.noMessages]);

  const statusOpts = [
    { value: 'all', label: isAr ? 'كل الحالات' : 'All statuses' },
    { value: 'Open', label: STR.open },
    { value: 'Closed', label: STR.closed },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
      </div>

      {/* Fixed-height two-pane inbox — the one view in this app that behaves
          like a standalone app rather than a scrolling document, so it sizes
          itself off the viewport instead of just growing with content. */}
      <div
        className="card"
        style={{
          padding: 0, display: 'flex', height: 'calc(100vh - 220px)', minHeight: 480,
          overflow: 'hidden',
        }}
      >
        {/* ── Left: conversation list ── */}
        <div style={{
          width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderInlineEnd: '1px solid var(--glass-border)', minHeight: 0,
        }}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--glass-border)' }}>
            <div className="search">
              <Icon name="search" size={14} />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder={STR.searchPh} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Select value={statusFilter} onChange={v => setStatusFilter(v || 'all')} options={statusOpts} />
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)',
                whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
              }}>
                <input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                {STR.onlyUnread}
              </label>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <DataTable
              columns={columns}
              data={conversations}
              loading={convLoading}
              emptyText={STR.noConversations}
              showSearch={false}
              manualPagination
              pageSize={convPageSize}
              pageIndex={convPageIndex}
              totalRows={convTotal}
              onPageChange={setConvPageIndex}
              onPageSizeChange={setConvPageSize}
              onRowClick={selectConversation}
              selectedRowId={selectedId}
            />
          </div>
        </div>

        {/* ── Right: open thread ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {!selectedConversation ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 10, color: 'var(--ink-faint)',
            }}>
              <Icon name="message" size={40} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: 13 }}>{STR.pickConversation}</div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--glass-border)', flexShrink: 0,
              }}>
                <Avatar initials={initialsFromName(selectedConversation.guestName)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedConversation.guestName || '—'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedConversation.guestEmail || '—'}
                  </div>
                </div>
                <span className={`chip ${selectedConversation.status === 'Closed' ? 'draft' : 'confirmed'}`}>
                  <span className="dot" />
                  {selectedConversation.status === 'Closed' ? STR.closed : STR.open}
                </span>
                {canManage && (
                  <button className="icon-btn" title={selectedConversation.status === 'Closed' ? STR.reopen : STR.close}
                    onClick={handleToggleStatus} disabled={togglingStatus}>
                    <Icon name={selectedConversation.status === 'Closed' ? 'refresh' : 'x'} size={15} />
                  </button>
                )}
              </div>

              {/* Message list */}
              <div ref={scrollRef} onScroll={handleThreadScroll} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', minHeight: 0 }}>
                {messagesLoading && messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>{STR.noMessages}</div>
                ) : (
                  <>
                    {messages.length < messagesTotal && (
                      <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <button className="btn" onClick={loadOlderMessages} disabled={loadingOlder} style={{ fontSize: 12 }}>
                          {loadingOlder ? '…' : STR.loadEarlier}
                        </button>
                      </div>
                    )}
                    {messages.map((m, i) => {
                      const prev = messages[i - 1];
                      const showDivider = !prev || !sameDay(prev.sentAt, m.sentAt);
                      const mine = m.fromGuest === false;
                      return (
                        <React.Fragment key={m.id}>
                          {showDivider && (
                            <div style={{ textAlign: 'center', margin: '14px 0', fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {dayLabel(m.sentAt, isAr)}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                            <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                              {mine && m.senderName && (
                                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 2 }}>{m.senderName}</div>
                              )}
                              <div style={{
                                padding: '9px 13px', borderRadius: mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                                background: mine ? 'var(--accent)' : 'var(--surface-soft-3)',
                                color: mine ? '#fff' : 'var(--ink)',
                                fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              }}>
                                {m.body}
                                {m.attachmentUrl && (
                                  m.attachmentType?.startsWith('image') ? (
                                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8 }}>
                                      <img src={m.attachmentUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                                    </a>
                                  ) : (
                                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer"
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>
                                      <Icon name="doc" size={13} /> {isAr ? 'مرفق' : 'Attachment'}
                                    </a>
                                  )
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 10.5, color: 'var(--ink-faint)' }}>
                                {timeOfDay(m.sentAt, isAr)}
                                {mine && (
                                  <span title={m.isRead ? STR.read : STR.sent} style={{ display: 'inline-flex', color: m.isRead ? 'var(--accent)' : 'var(--ink-faint)' }}>
                                    <Icon name="checkDouble" size={12} />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Composer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                {!canManage ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: '6px 0' }}>{STR.viewOnly}</div>
                ) : selectedConversation.status === 'Closed' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{STR.closedBanner}</span>
                    <button className="btn primary" onClick={handleToggleStatus} disabled={togglingStatus}>
                      <Icon name="refresh" size={13} /> {STR.reopen}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={e => { setDraft(e.target.value); autoResize(); }}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={STR.composerPh}
                      maxLength={MAX_BODY_LENGTH}
                      rows={1}
                      style={{
                        flex: 1, resize: 'none', maxHeight: 140, background: 'var(--surface-soft-3)',
                        border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 13px',
                        color: 'var(--ink)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <button
                      className="btn primary"
                      onClick={handleSend}
                      disabled={!draft.trim() || sending}
                      style={{ flexShrink: 0, height: 40, width: 40, padding: 0, justifyContent: 'center' }}
                      title={STR.send}
                    >
                      <Icon name="send" size={16} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
