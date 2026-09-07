import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icons";
import { useAuth } from "../auth/AuthContext";
import { onHub, REALTIME_TOPICS } from "../lib/realtimeHub";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/services/notificationService";
import toast from "../lib/toast";

function notifRelativeTime(iso, isAr) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((new Date() - d) / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isAr ? `${hours} س` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return isAr ? `${days} ي` : `${days}d`;
}

// The notification bell + dropdown. Fully self-contained: owns its own
// open/list/unread-count state and the realtime subscriptions that keep them
// live, since nothing outside the bell needs any of it.
export default function NotificationMenu({ lang }) {
  const isAr = lang === "ar";
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = React.useRef(null);

  const refreshUnreadCount = React.useCallback(() => {
    if (isDemo) return;
    getUnreadCount()
      .then((n) => setUnreadCount(n || 0))
      .catch(() => {});
  }, [isDemo]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(
    () => onHub(REALTIME_TOPICS.NOTIFICATION_COUNT_CHANGED, refreshUnreadCount),
    [refreshUnreadCount],
  );

  // Prepend the just-pushed notification so an open dropdown updates live too.
  useEffect(
    () =>
      onHub(REALTIME_TOPICS.NOTIFICATION_NEW, (title, message, data) => {
        setUnreadCount((c) => c + 1);
        setNotifications((list) =>
          [
            {
              id: data?.id || `live-${Date.now()}`,
              title,
              message,
              redirectUrl: data?.redirectUrl,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...list,
          ].slice(0, 20),
        );
      }),
    [],
  );

  useEffect(() => {
    if (!showNotifications || isDemo) return;
    getNotifications({ pageNumber: 1, pageSize: 20 })
      .then((r) => setNotifications(r?.items || r || []))
      .catch((err) => toast.fromError(err, isAr ? 'تعذّر تحميل التنبيهات' : 'Could not load notifications'));
  }, [showNotifications, isDemo, isAr]);

  useEffect(() => {
    if (!showNotifications) return;
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [showNotifications]);

  const openNotification = (n) => {
    if (!n.read) {
      // Optimistic below; without this the row silently comes back unread.
      markNotificationRead(n.id).catch((err) =>
        toast.fromError(err, isAr ? 'تعذّر تحديث التنبيه' : 'Could not mark as read'));
      setNotifications((list) =>
        list.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    if (n.redirectUrl) navigate(n.redirectUrl);
  };

  const markAllRead = () => {
    markAllNotificationsRead().catch((err) =>
      toast.fromError(err, isAr ? 'تعذّر تحديث التنبيهات' : 'Could not mark all as read'));
    setNotifications((list) => list.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="notif-wrap" ref={notifRef}>
      <button
        className="icon-btn"
        title={lang === "ar" ? "الإشعارات" : "Notifications"}
        onClick={() => setShowNotifications((o) => !o)}
      >
        <Icon name="bell" size={16} />
        {unreadCount > 0 && <span className="dot notif-dot-blink" />}
      </button>
      {showNotifications && (
        <div className="notif-menu">
          <div className="notif-head">
            <span>{lang === "ar" ? "الإشعارات" : "Notifications"}</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllRead}>
                {lang === "ar" ? "تعليم الكل كمقروء" : "Mark all read"}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <Icon name="bell" size={22} />
              <span>{lang === "ar" ? "لا توجد إشعارات" : "No notifications"}</span>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={"notif-item" + (n.read ? "" : " unread")}
                  onClick={() => openNotification(n)}
                >
                  <div className="notif-item-title">{n.title || n.message}</div>
                  {n.title && n.message && (
                    <div className="notif-item-body">{n.message}</div>
                  )}
                  <div className="notif-item-time">
                    {notifRelativeTime(n.createdAt, lang === "ar")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
