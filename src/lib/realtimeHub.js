// Singleton SignalR connection to /realtimehub. Mirrors Core.Constants.RealtimeTopics
// on the backend — every topic the hub can push is listed here.
import * as signalR from '@microsoft/signalr';
import { HUB_URL } from '../config/env';
import { tokenStore } from '../auth/tokenStore';

export const REALTIME_TOPICS = {
  SUPPORT_MESSAGE_NEW: 'support-message-new',
  SUPPORT_CONVERSATION_READ: 'support-conversation-read',
  NOTIFICATION_NEW: 'notification-new',
  NOTIFICATION_COUNT_CHANGED: 'notification-count-changed',
};

let connection = null;

function build() {
  return new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => tokenStore.accessToken() || '' })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();
}

export function connectHub() {
  if (connection) return Promise.resolve();
  connection = build();
  return connection.start().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[realtimeHub] connect failed', err);
  });
}

export function disconnectHub() {
  if (!connection) return;
  const c = connection;
  connection = null;
  c.stop().catch(() => {});
}

// Subscribe to a topic; returns an unsubscribe function. Safe to call before
// the connection finishes starting — handlers just won't fire until connected.
// Captures the connection instance at subscribe time so unsubscribing after a
// reconnect/disconnect cycle still detaches from the right object.
export function onHub(topic, handler) {
  if (!connection) connectHub();
  const conn = connection;
  conn.on(topic, handler);
  return () => conn.off(topic, handler);
}
