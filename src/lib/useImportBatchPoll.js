import { useEffect, useRef, useState } from 'react';

// Polls `fetchStatus(batchId)` every `intervalMs` until the batch reaches a
// terminal status ("completed"/"failed"). Used by the Events/Guests import
// modals — the upload itself only kicks off a background job, so the UI has
// to poll to show live progress instead of getting one final response.
export default function useImportBatchPoll(batchId, fetchStatus, { intervalMs = 2000 } = {}) {
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!batchId) { setStatus(null); return undefined; }
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetchStatus(batchId);
        if (cancelled) return;
        setStatus(res);
        if (res?.status === 'completed' || res?.status === 'failed') return;
        timerRef.current = setTimeout(poll, intervalMs);
      } catch {
        if (!cancelled) timerRef.current = setTimeout(poll, intervalMs);
      }
    }
    poll();

    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [batchId, fetchStatus, intervalMs]);

  return status;
}
