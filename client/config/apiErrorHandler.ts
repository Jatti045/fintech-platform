import { store } from "@/store/store";

/**
 * Unified API error type returned by the response interceptor.
 * Every rejected promise from `apiClient` resolves to this shape.
 */
export interface ApiError {
  message: string;
  status?: number;
  data?: any;
}

/**
 * Ref-holder for the `showAlert` function exposed by `AlertProvider`.
 *
 * Because the Axios interceptor runs outside the React tree we can't call
 * `useThemedAlert()` directly. Instead `AlertProvider` registers its
 * `showAlert` here on mount so the interceptor can trigger the themed modal
 * for opted-in requests only (see below).
 */
let _showAlert: ((opts: { title: string; message?: string }) => void) | null =
  null;

export const registerAlertRef = (
  fn: (opts: { title: string; message?: string }) => void,
) => {
  _showAlert = fn;
};

export const unregisterAlertRef = () => {
  _showAlert = null;
};

/**
 * Global-error policy: **silent by default**.
 *
 * A failed request surfaces a global alert ONLY when the request explicitly
 * opted in via `{ meta: { globalError: true } }`. Opt in exclusively for
 * user-initiated requests that have no more appropriate local error UI —
 * never for background polling, cache revalidation, prefetches, or
 * fire-and-forget refreshes, and never when a screen/hook already renders
 * the error itself. Screens and hooks own their error feedback (inline
 * messages, alerts); the interceptor is a last-resort fallback.
 */
const SILENT_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/register"];

/**
 * Called by the Axios response-error interceptor.
 * Normalizes the failure into an `ApiError`, logs it, and — for opted-in
 * requests only — shows a themed alert. Haptics are NOT fired here: they
 * belong to the specific user-action handlers that know the interaction
 * context.
 */
export function handleApiError(error: any): ApiError {
  const defaultMsg = "An unexpected error occurred.";
  const normalized: ApiError = {
    message: error?.response?.data?.message || error?.message || defaultMsg,
    status: error?.response?.status,
    data: error?.response?.data,
  };

  // Determine whether this endpoint should be handled silently
  const url = error?.config?.url ?? "";
  const isSilent = SILENT_ENDPOINTS.some((ep) => url.includes(ep));

  const globalErrorOptedIn = error?.config?.meta?.globalError === true;

  // Show a global alert only for opted-in, non-auth-endpoint, non-401 errors
  if (globalErrorOptedIn && !isSilent && normalized.status !== 401 && _showAlert) {
    const title =
      normalized.status && normalized.status >= 500
        ? "Server Error"
        : "Request Failed";
    _showAlert({ title, message: normalized.message });
  }

  return normalized;
}
