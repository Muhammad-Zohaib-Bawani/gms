// Admin side of guest ↔ support chat. Two-pane inbox: a left sidebar with two
// lazy-loaded lists — guests who already have a conversation, and any guest in
// the active event an admin can start one with — and the open thread + rich
// composer on the right (WhatsApp Web / Intercom-style layout).
//
// Backend is already live (SupportChatController / SupportChatService); this
// file is the integration + UI. Read-only for anyone without SupportChat.Manage
// — they can open and read threads, but the composer and close/reopen controls
// disappear.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icons';
import { fmtDate, fmtDayMonth } from '../lib/date';
import MessageList from './supportChat/MessageList.jsx';
import { Avatar } from '../components/UI';
import GuestCell from '../components/GuestCell';
import Select from '../components/ui/Select';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getConversations, getMessages, replyToConversation, startConversationWithGuest,
  markConversationRead, closeConversation, reopenConversation,
} from '../api/services/supportChatService';
import { getGuestPicker } from '../api/services/guestService';
import { getOrganizations } from '../api/services/organizationService';
import { getNationalities } from '../api/services/nationalityService';
import RichComposer from './supportChat/RichComposer';
import { onHub, REALTIME_TOPICS } from '../lib/realtimeHub';

const TIERS = ['vvip', 'vip', 'Speaker', 'Delegate', 'press', 'Observer'];

// Polling cadence for v1 (no realtime client in this frontend yet). Each poll
// site is commented as the seam to swap for a SignalR subscription to the
// already-mapped /realtimehub "SupportMessageNew" event later.
// Safety-net fallback only — SignalR delivers instantly; this just covers
// reconnect gaps / backgrounded tabs where a push could be missed.
const CONVERSATIONS_POLL_MS = 60000;
const MESSAGES_POLL_MS = 60000;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const LIST_STEP = 5; // both sidebar lists load/lazy-scroll in batches of 5

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

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
  // Older than a week: an actual date, in the portal's DD-MM (no room for the
  // year in an inbox row).
  return fmtDayMonth(d);
}

function timeOfDay(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(isAr ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const daysDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (daysDiff === 0) return isAr ? 'اليوم' : 'Today';
  if (daysDiff === 1) return isAr ? 'أمس' : 'Yesterday';
  return fmtDate(d);
}

// Client-side approximation of the backend's ComputePreview, used only for
// the optimistic sidebar update right after sending — the next poll replaces
// it with the server's real (also-stripped) preview regardless.
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// New messages are plain text. Rows written before that (admin replies stored as
// "<p>…</p>" by the old rich-text composer) would otherwise show their tags now
// that nothing renders HTML — so unwrap only bodies that clearly start with the
// old editor's own markup, and leave real text containing "<" alone.
const LEGACY_HTML_BODY = /^\s*<(p|ul|ol|div|br)[\s>/]/i;

function plainBody(body) {
  if (!body) return '';
  if (!LEGACY_HTML_BODY.test(body)) return body;
  return stripHtml(body.replace(/<\/(p|li|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')).trim();
}

function sameDay(a, b) {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ── Lazy-loaded list: fetchPage(pageNumber, pageSize) -> { items, totalCount } ─
// Reused for both sidebar lists (existing conversations, guest picker) — same
// paging/search shape, different backend calls.
function useLazyList(fetchPage, resetDeps, pageSize = LIST_STEP) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRef.current(1, pageSize)
      .then((r) => {
        if (cancelled) return;
        setItems(r?.items || []);
        setTotal(r?.totalCount ?? 0);
        setPage(1);
      })
      .catch(() => { if (!cancelled) { setItems([]); setTotal(0); setPage(1); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const r = await fetchRef.current(nextPage, pageSize);
      setItems((prev) => [...prev, ...(r?.items || [])]);
      setTotal(r?.totalCount ?? total);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, page, pageSize, total]);

  // Silent refresh of the currently-loaded window — same item count/order,
  // just fresher field values (unread counts, latest preview). Keeps scroll
  // position stable since it doesn't reset to page 1's size.
  const refresh = useCallback(async () => {
    try {
      const r = await fetchRef.current(1, Math.max(items.length, pageSize));
      setItems(r?.items || []);
      setTotal((t) => r?.totalCount ?? t);
    } catch { /* keep stale data, try again next poll */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, pageSize]);

  const prepend = useCallback((item) => {
    setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
    setTotal((t) => (items.some((x) => x.id === item.id) ? t : t + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const patchItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  return { items, total, loading, loadingMore, hasMore, loadMore, refresh, prepend, patchItem };
}

// Fires onNearBottom once the scroll position gets within `threshold`px of the
// bottom — the actual "load 5 more on scroll" trigger for both sidebar lists.
function LazyScrollList({ onNearBottom, threshold = 80, children, style }) {
  function handleScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) onNearBottom();
  }
  return <div onScroll={handleScroll} style={{ overflowY: 'auto', ...style }}>{children}</div>;
}

export default function SupportChatView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('SupportChat.Manage');
  const location = useLocation();
  const navigate = useNavigate();

  const STR = {
    title: isAr ? 'الدعم الفني' : 'Guests Chat',
    sub: "",
    tabChats: isAr ? 'المحادثات' : 'Chats',
    tabNew: isAr ? 'محادثة جديدة' : 'New Chat',
    searchPh: isAr ? 'ابحث بالاسم أو البريد الإلكتروني…' : 'Search by name or email…',
    searchGuestsPh: isAr ? 'ابحث عن ضيف…' : 'Search guests…',
    onlyUnread: isAr ? 'غير مقروءة فقط' : 'Unread only',
    filter: isAr ? 'تصفية' : 'Filter',
    filterChats: isAr ? 'تصفية المحادثات' : 'Filter Chats',
    clearAll: isAr ? 'مسح الكل' : 'Clear all',
    status: isAr ? 'الحالة' : 'Status',
    tier: isAr ? 'الفئة' : 'Tier',
    organization: isAr ? 'المؤسسة' : 'Organization',
    nationality: isAr ? 'الجنسية' : 'Nationality',
    noConversations: isAr ? 'لا توجد محادثات' : 'No conversations',
    noGuests: isAr ? 'لا يوجد ضيوف' : 'No guests found',
    needEvent: isAr ? 'اختر فعالية أولاً لعرض ضيوفها' : 'Select an active event to see its guests',
    pickConversation: isAr ? 'اختر محادثة لعرض الرسائل' : 'Select a conversation, or start a new one',
    noMessages: isAr ? 'لا توجد رسائل بعد' : 'No messages yet',
    sayHello: isAr ? 'ابدأ المحادثة بإرسال أول رسالة' : 'Say hello to start the conversation',
    loadEarlier: isAr ? 'تحميل الرسائل الأقدم' : 'Load earlier messages',
    composerPh: isAr ? 'اكتب ردًا…' : 'Type a reply…',
    viewOnly: isAr ? 'وصول للعرض فقط — لا يمكنك الرد' : 'View-only access — you cannot reply',
    closed: isAr ? 'مغلقة' : 'Closed',
    open: isAr ? 'مفتوحة' : 'Open',
    new: isAr ? 'جديدة' : 'New',
    close: isAr ? 'إغلاق المحادثة' : 'Close conversation',
    reopen: isAr ? 'إعادة فتح المحادثة' : 'Reopen conversation',
    closedBanner: isAr ? 'هذه المحادثة مغلقة. أعد فتحها للرد.' : 'This conversation is closed. Reopen it to reply.',
    you: isAr ? 'أنت' : 'You',
    read: isAr ? 'مقروءة' : 'Read',
    sent: isAr ? 'مُرسلة' : 'Sent',
  };

  // ── Left pane: which list tab, each independently lazy-loaded ─────────────
  const [listTab, setListTab] = useState('chats'); // 'chats' | 'new'

  const [chatSearchInput, setChatSearchInput] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | Open | Closed
  const [orgFilter, setOrgFilter] = useState('All');
  const [nationalityFilter, setNationalityFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  useEffect(() => {
    const t = setTimeout(() => setChatSearch(chatSearchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [chatSearchInput]);

  // Organization/Nationality options for the filter panel — loaded once,
  // lazily, the first time the panel is opened (same trigger as Guests).
  const [refDataLoaded, setRefDataLoaded] = useState(false);
  const toggleFilterPanel = () => {
    if (!showFilterPanel && !refDataLoaded) {
      setRefDataLoaded(true);
      getOrganizations().then((r) => setOrganizations(r || [])).catch(() => setRefDataLoaded(false));
      getNationalities().then((r) => setNationalities(r || [])).catch(() => {});
    }
    setShowFilterPanel((o) => !o);
  };

  const activeFilterCount = [
    statusFilter !== 'all', onlyUnread, orgFilter !== 'All', nationalityFilter !== 'All', tierFilter !== 'All',
  ].filter(Boolean).length;
  const clearAllFilters = () => {
    setStatusFilter('all'); setOnlyUnread(false);
    setOrgFilter('All'); setNationalityFilter('All'); setTierFilter('All');
  };

  // Close the filter panel on an outside click or Escape — same pattern as
  // the Guests page filter panel.
  const filterPanelRef = useRef(null);
  useEffect(() => {
    if (!showFilterPanel) return;
    const onDoc = (e) => { if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShowFilterPanel(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [showFilterPanel]);

  const fetchChatsPage = useCallback((pageNumber, pageSize) => getConversations({
    pageNumber, pageSize,
    search: chatSearch || undefined,
    onlyUnread: onlyUnread || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    organizationId: orgFilter !== 'All' ? orgFilter : undefined,
    nationalityId: nationalityFilter !== 'All' ? nationalityFilter : undefined,
    tier: tierFilter !== 'All' ? tierFilter : undefined,
  }), [chatSearch, onlyUnread, statusFilter, orgFilter, nationalityFilter, tierFilter]);

  const chats = useLazyList(fetchChatsPage, [chatSearch, onlyUnread, statusFilter, orgFilter, nationalityFilter, tierFilter]);

  // Instant refresh on push; the interval below stays as a fallback in case a
  // hub event is missed (reconnect gap, tab was backgrounded, etc).
  useEffect(() => onHub(REALTIME_TOPICS.SUPPORT_MESSAGE_NEW, () => chats.refresh()), [chats.refresh]);

  useEffect(() => {
    const t = setInterval(() => chats.refresh(), CONVERSATIONS_POLL_MS);
    return () => clearInterval(t);
  }, [chats.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pickerSearchInput, setPickerSearchInput] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setPickerSearch(pickerSearchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [pickerSearchInput]);

  const fetchGuestsPage = useCallback((pageNumber, pageSize) => (
    activeEventId
      ? getGuestPicker({ eventId: activeEventId, search: pickerSearch || undefined, pageNumber, pageSize })
      : Promise.resolve({ items: [], totalCount: 0 })
  ), [activeEventId, pickerSearch]);

  const guestPicker = useLazyList(fetchGuestsPage, [activeEventId, pickerSearch]);

  // ── Selection: an existing conversation, OR a guest picked to start fresh
  // with (mutually exclusive — picking one clears the other). Held as a full
  // object (not just an id) so it keeps working even once scrolled out of the
  // lazily-loaded window, and so a brand-new conversation can be selected
  // before it's actually present in `chats.items`. ───────────────────────────
  const [activeConversation, setActiveConversation] = useState(null);
  const [pendingGuest, setPendingGuest] = useState(null);
  const markedReadRef = useRef(new Set());

  // View-only admins can't send anything, so "start a new chat" has nothing
  // for them to do there — the tab (and its guest picker) is manage-only.
  useEffect(() => {
    if (!canManage && listTab === 'new') setListTab('chats');
  }, [canManage, listTab]);

  function openConversation(conv) {
    setPendingGuest(null);
    setActiveConversation(conv);
  }

  function startNewChat(guest) {
    // If this guest already has a thread (possibly outside the loaded window),
    // just open it instead of pretending there's no history.
    const existing = chats.items.find((c) => c.guestId === guest.id);
    if (existing) { openConversation(existing); setListTab('chats'); return; }
    setActiveConversation(null);
    setPendingGuest(guest);
  }
  const incomingGuestId = location.state?.guestId || null;
  useEffect(() => {
    if (!incomingGuestId || chats.loading) return;
    startNewChat({
      id: incomingGuestId,
      fullName: location.state.guestName || '',
      organization: location.state.guestOrganization || '',
    });
    setListTab('chats');
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingGuestId, chats.loading]);

  // ── Open thread ─────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagePageSize, setMessagePageSize] = useState(DEFAULT_MESSAGE_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const fetchMessages = useCallback(async (conversationId, { silent, size } = {}) => {
    if (!conversationId) return;
    if (!silent) setMessagesLoading(true);
    try {
      const r = await getMessages(conversationId, { pageSize: size ?? messagePageSize });
      setMessages(r?.items || []);
      setMessagesTotal(r?.totalCount ?? 0);
    } catch (err) {
      if (!silent) toast.fromError(err);
    } finally {
      if (!silent) setMessagesLoading(false);
      setLoadingOlder(false);
    }
  }, [messagePageSize]);

  const activeId = activeConversation?.id || null;

  // Reset + load the first page whenever the open conversation changes.
  useEffect(() => {
    setMessages([]);
    setMessagesTotal(0);
    setMessagePageSize(DEFAULT_MESSAGE_PAGE_SIZE);
    stickToBottomRef.current = true;
    if (activeId) fetchMessages(activeId, { size: DEFAULT_MESSAGE_PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Instant refresh of the open thread on push; interval stays as fallback.
  useEffect(() => {
    if (!activeId) return undefined;
    return onHub(REALTIME_TOPICS.SUPPORT_MESSAGE_NEW, () => fetchMessages(activeId, { silent: true }));
  }, [activeId, fetchMessages]);

  useEffect(() => {
    if (!activeId) return undefined;
    const t = setInterval(() => fetchMessages(activeId, { silent: true }), MESSAGES_POLL_MS);
    return () => clearInterval(t);
  }, [activeId, fetchMessages]);

  // Auto mark-read once per selection, when opening a thread with unread guest
  // messages — "open the thread" is the natural admin equivalent of reading it.
  useEffect(() => {
    if (!activeConversation || !canManage || activeConversation.unreadCount <= 0) return;
    const id = activeConversation.id;
    if (markedReadRef.current.has(id)) return;
    markedReadRef.current.add(id);
    markConversationRead(id)
      .then(() => {
        setActiveConversation((prev) => (prev && prev.id === id ? { ...prev, unreadCount: 0 } : prev));
        chats.patchItem(id, { unreadCount: 0 });
      })
      .catch(() => markedReadRef.current.delete(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, canManage]);

  useEffect(() => {
    if (!stickToBottomRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function handleThreadScroll(e) {
    const el = e.target;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlderMessages() {
    if (!activeId || loadingOlder || messages.length >= messagesTotal) return;
    setLoadingOlder(true);
    const nextSize = messagePageSize + DEFAULT_MESSAGE_PAGE_SIZE;
    setMessagePageSize(nextSize);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    await fetchMessages(activeId, { size: nextSize });
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
  }

  // `payload` = { body, attachmentUrl, attachmentType } from RichComposer.
  // Returns false on failure so the composer keeps the draft instead of
  // clearing it.
  async function handleSendPayload(payload) {
    setSending(true);
    try {
      if (pendingGuest) {
        const msg = await startConversationWithGuest(pendingGuest.id, payload);
        const newConv = {
          id: msg.conversationId,
          guestId: pendingGuest.id,
          guestName: pendingGuest.fullName,
          guestEmail: pendingGuest.email || null,
          status: 'Open',
          // Approximate until the next poll brings the server-computed preview
          // (which strips HTML and falls back to an attachment label).
          lastMessagePreview: stripHtml(payload.body) || (payload.attachmentUrl ? (isAr ? '📎 مرفق' : '📎 Attachment') : ''),
          lastMessageAt: msg.sentAt,
          lastMessageFromGuest: false,
          unreadCount: 0,
        };
        chats.prepend(newConv);
        setPendingGuest(null);
        setActiveConversation(newConv);
        setListTab('chats');
        stickToBottomRef.current = true;
        return true;
      }
      if (activeConversation) {
        const msg = await replyToConversation(activeConversation.id, payload);
        setMessages((prev) => [...prev, msg]);
        setMessagesTotal((t) => t + 1);
        stickToBottomRef.current = true;
        chats.patchItem(activeConversation.id, {
          lastMessageAt: msg.sentAt,
          lastMessageFromGuest: false,
          lastMessagePreview: stripHtml(payload.body)
            || (payload.attachmentUrl ? (isAr ? '📎 مرفق' : '📎 Attachment') : activeConversation.lastMessagePreview),
        });
        return true;
      }
      return false;
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر إرسال الرسالة' : 'Could not send the message');
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleToggleStatus() {
    if (!activeConversation || togglingStatus) return;
    const closing = activeConversation.status !== 'Closed';
    setTogglingStatus(true);
    try {
      if (closing) await closeConversation(activeConversation.id);
      else await reopenConversation(activeConversation.id);
      const nextStatus = closing ? 'Closed' : 'Open';
      setActiveConversation((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      chats.patchItem(activeConversation.id, { status: nextStatus });
      toast.success(closing ? (isAr ? 'تم إغلاق المحادثة' : 'Conversation closed') : (isAr ? 'تم إعادة فتح المحادثة' : 'Conversation reopened'));
    } catch (err) {
      toast.fromError(err);
    } finally {
      setTogglingStatus(false);
    }
  }

  const statusOpts = useMemo(() => [
    { value: 'all', label: isAr ? 'كل الحالات' : 'All statuses' },
    { value: 'Open', label: STR.open },
    { value: 'Closed', label: STR.closed },
  ], [isAr, STR.open, STR.closed]);

  const tierFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل الفئات' : 'All Tiers' },
    ...TIERS.map((t) => ({ value: t, label: t })),
  ], [isAr]);

  const orgFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل المؤسسات' : 'All Organizations' },
    ...organizations.map((o) => ({ value: o.id, label: isAr ? (o.nameAr || o.name) : o.name })),
  ], [organizations, isAr]);

  const nationalityFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل الجنسيات' : 'All Nationalities' },
    ...nationalities.map((n) => ({ value: n.id, label: `${n.flag} ${isAr ? n.nameAr : n.name}` })),
  ], [nationalities, isAr]);

  const threadGuest = activeConversation
    ? { name: activeConversation.guestName, email: activeConversation.guestEmail, photoUrl: activeConversation.guestPhotoUrl }
    : pendingGuest
      ? { name: pendingGuest.fullName, email: pendingGuest.email, photoUrl: pendingGuest.photoUrl }
      : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
      </div>

      {/* Fixed-height two-pane inbox — sizes off the viewport rather than
          growing with content, since a chat thread behaves like an app, not
          a scrolling document. */}
      <div className="card" style={{ padding: 0, display: 'flex', height: 'calc(100vh - 220px)', minHeight: 480, overflow: 'hidden' }}>
        {/* ── Left: two lazy-loaded lists behind a tab switch ── */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderInlineEnd: '1px solid var(--glass-border)', minHeight: 0 }}>
          {canManage && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
            {['chats', 'new'].map((tab) => (
              <button
                key={tab}
                onClick={() => setListTab(tab)}
                style={{
                  flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, color: listTab === tab ? 'var(--accent)' : 'var(--ink-mute)',
                  borderBottom: listTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {tab === 'chats' ? STR.tabChats : STR.tabNew}
              </button>
            ))}
          </div>
          )}

          {listTab === 'chats' ? (
            <>
              <div style={{ padding: 14, display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="search" style={{ flex: 1, minWidth: 0, padding: '7px 12px' }}>
                  <Icon name="search" size={14} />
                  <input value={chatSearchInput} onChange={(e) => setChatSearchInput(e.target.value)} placeholder={STR.searchPh} />
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }} ref={filterPanelRef}>
                  <button
                    className="btn"
                    onClick={toggleFilterPanel}
                    style={{ position: 'relative', padding: '7px 10px' }}
                    title={STR.filter}
                  >
                    <Icon name="filter" size={14} />
                    {activeFilterCount > 0 && (
                      <span style={{
                        position: 'absolute', top: -6, insetInlineEnd: -6,
                        minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                        background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700,
                        display: 'grid', placeItems: 'center', lineHeight: 1,
                      }}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {showFilterPanel && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0,
                      width: 280, zIndex: 200, padding: 14, borderRadius: 12,
                      background: 'var(--popover-bg)', border: '1px solid var(--glass-border-strong)',
                      boxShadow: '0 24px 50px -16px rgba(0,0,0,0.7), 0 6px 16px -6px rgba(0,0,0,0.45)',
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                          {STR.filterChats}
                        </span>
                        {activeFilterCount > 0 && (
                          <button
                            onClick={clearAllFilters}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', padding: 0 }}
                          >
                            {STR.clearAll}
                          </button>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                          {STR.status}
                        </label>
                        <Select value={statusFilter} onChange={(v) => setStatusFilter(v || 'all')} options={statusOpts} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                          {STR.tier}
                        </label>
                        <Select value={tierFilter} onChange={(v) => setTierFilter(v || 'All')} options={tierFilterOpts} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                          {STR.organization}
                        </label>
                        <Select value={orgFilter} onChange={(v) => setOrgFilter(v || 'All')} options={orgFilterOpts} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                          {STR.nationality}
                        </label>
                        <Select value={nationalityFilter} onChange={(v) => setNationalityFilter(v || 'All')} options={nationalityFilterOpts} />
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        {STR.onlyUnread}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <LazyScrollList onNearBottom={chats.loadMore} style={{ flex: 1, minHeight: 0 }}>
                {chats.loading ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>…</div>
                ) : chats.items.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>{STR.noConversations}</div>
                ) : (
                  chats.items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => openConversation(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer',
                        background: activeConversation?.id === c.id ? 'rgba(141, 1, 52,0.1)' : 'transparent',
                        boxShadow: activeConversation?.id === c.id ? 'inset 3px 0 0 var(--accent)' : 'none',
                        borderBottom: '1px solid var(--glass-border)',
                      }}
                    >
                      <Avatar initials={initialsFromName(c.guestName)} size={34} src={c.guestPhotoUrl} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                            {c.guestName || '—'}
                          </span>
                          <span title={c.status} style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: c.status === 'Closed' ? 'var(--ink-faint)' : 'var(--accent)' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{
                            fontSize: 12, color: c.unreadCount > 0 ? 'var(--ink)' : 'var(--ink-mute)', fontWeight: c.unreadCount > 0 ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {c.lastMessagePreview ? `${c.lastMessageFromGuest === false ? `${STR.you}: ` : ''}${c.lastMessagePreview}` : STR.noMessages}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', flexShrink: 0 }}>{relativeTime(c.lastMessageAt, isAr)}</span>
                        </div>
                      </div>
                      {c.unreadCount > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  ))
                )}
                {chats.loadingMore && <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, padding: 10 }}>…</div>}
              </LazyScrollList>
            </>
          ) : (
            <>
              <div style={{ padding: 14, borderBottom: '1px solid var(--glass-border)' }}>
                <div className="search">
                  <Icon name="search" size={14} />
                  <input value={pickerSearchInput} onChange={(e) => setPickerSearchInput(e.target.value)} placeholder={STR.searchGuestsPh} />
                </div>
              </div>

              <LazyScrollList onNearBottom={guestPicker.loadMore} style={{ flex: 1, minHeight: 0 }}>
                {!activeEventId ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>{STR.needEvent}</div>
                ) : guestPicker.loading ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>…</div>
                ) : guestPicker.items.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>{STR.noGuests}</div>
                ) : (
                  guestPicker.items.map((g) => {
                    const isActive = pendingGuest?.id === g.id || activeConversation?.guestId === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => startNewChat(g)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer',
                          background: isActive ? 'rgba(141, 1, 52,0.1)' : 'transparent',
                          boxShadow: isActive ? 'inset 3px 0 0 var(--accent)' : 'none',
                          borderBottom: '1px solid var(--glass-border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <GuestCell name={g.fullName} email={g.email} photoUrl={g.photoUrl} tier={g.tier} size={34} />
                        </div>
                        <Icon name="message" size={14} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                      </div>
                    );
                  })
                )}
                {guestPicker.loadingMore && <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, padding: 10 }}>…</div>}
              </LazyScrollList>
            </>
          )}
        </div>

        {/* ── Right: open thread ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {!threadGuest ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-faint)' }}>
              <Icon name="message" size={40} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: 13 }}>{STR.pickConversation}</div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
                <Avatar initials={initialsFromName(threadGuest.name)} size={36} src={threadGuest.photoUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{threadGuest.name || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{threadGuest.email || '—'}</div>
                </div>
                <span className={`chip ${!activeConversation ? 'pending' : activeConversation.status === 'Closed' ? 'draft' : 'confirmed'}`}>
                  <span className="dot" />
                  {!activeConversation ? STR.new : activeConversation.status === 'Closed' ? STR.closed : STR.open}
                </span>
                {canManage && activeConversation && (
                  <button className="icon-btn" title={activeConversation.status === 'Closed' ? STR.reopen : STR.close} onClick={handleToggleStatus} disabled={togglingStatus}>
                    <Icon name={activeConversation.status === 'Closed' ? 'refresh' : 'x'} size={15} />
                  </button>
                )}
              </div>

              {/* Message list */}
              <div ref={scrollRef} onScroll={handleThreadScroll} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', minHeight: 0 }}>
                {pendingGuest ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, padding: 24 }}>{STR.sayHello}</div>
                ) : messagesLoading && messages.length === 0 ? (
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
                    <MessageList
                      messages={messages}
                      isAr={isAr}
                      STR={STR}
                      plainBody={plainBody}
                      sameDay={sameDay}
                      dayLabel={dayLabel}
                      timeOfDay={timeOfDay}
                      initialsFromName={initialsFromName}
                      guestName={activeConversation?.guestName}
                    />
                  </>
                )}
              </div>

              {/* Composer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                {!canManage ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: '6px 0' }}>{STR.viewOnly}</div>
                ) : activeConversation?.status === 'Closed' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>{STR.closedBanner}</span>
                    <button className="btn primary" onClick={handleToggleStatus} disabled={togglingStatus}>
                      <Icon name="refresh" size={13} /> {STR.reopen}
                    </button>
                  </div>
                ) : (
                  <RichComposer
                    key={pendingGuest ? `guest-${pendingGuest.id}` : activeConversation ? `conv-${activeConversation.id}` : 'none'}
                    isAr={isAr}
                    placeholder={STR.composerPh}
                    disabled={false}
                    sending={sending}
                    onSend={handleSendPayload}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
