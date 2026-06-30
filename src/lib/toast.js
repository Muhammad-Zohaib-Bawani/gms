// Single toast entry point for the whole portal. Always import from here so the
// look/behaviour can be tuned centrally.
import { toast as sonner } from 'sonner';

export const toast = {
  success: (message, opts) => sonner.success(message, opts),
  error: (message, opts) => sonner.error(message, opts),
  warning: (message, opts) => sonner.warning(message, opts),
  info: (message, opts) => sonner.info(message, opts),
  message: (message, opts) => sonner(message, opts),
  // Resolve a thrown ApiError (or anything) to an error toast.
  fromError: (err, fallback = 'Something went wrong') =>
    sonner.error(err?.message || fallback),
};

export default toast;
