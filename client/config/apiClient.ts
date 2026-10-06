import axios from "axios";
import { handleApiError } from "./apiErrorHandler";
import { API_TIMEOUT_MS } from "@/constants/appConfig";
import { getSessionIdentity, invalidateSession, sessionGeneration, type SessionIdentity } from "@/utils/session";

import { logger } from "@/utils/logger";

type SessionConfig = { sessionIdentity?: SessionIdentity };

const SCOPE = "apiClient";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured");
}

// Configure axios defaults
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: API_TIMEOUT_MS,
});

const PUBLIC_AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/google",
  "/auth/register",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// Attach token before each request if available
apiClient.interceptors.request.use(
  async (config) => {
    logger.debug(
      SCOPE,
      `API request: ${config.method?.toUpperCase()} ${config.url}`,
    );

    const url = config.url ?? "";
    const isPublicAuthEndpoint = PUBLIC_AUTH_ENDPOINTS.some((endpoint) =>
      url.includes(endpoint),
    );

    // Record the exact session used by this request.
    if (!isPublicAuthEndpoint) {
      try {
        const identity = await getSessionIdentity();
        if (identity) {
          (config as typeof config & SessionConfig).sessionIdentity = identity;
          config.headers.Authorization = `Bearer ${identity.token}`;
        }
      } catch (err) {
        logger.warn(SCOPE, "Failed to read auth token", err);
      }
    }

    return config;
  },
  (error) => {
    logger.error(SCOPE, "Request setup failed", error);
    return Promise.reject(error);
  },
);

// Log responses and handle global errors
apiClient.interceptors.response.use(
  (response) => {
    const identity = (response.config as typeof response.config & SessionConfig).sessionIdentity;
    if (identity && identity.generation !== sessionGeneration()) {
      return Promise.reject({ status: 401, message: "Response belongs to an inactive session" });
    }
    logger.debug(
      SCOPE,
      `API response: ${response.status} ${response.config.url}`,
    );
    return response;
  },
  async (error) => {
    const normalized = handleApiError(error);

    logger.error(
      SCOPE,
      `API error: ${error.config?.url ?? "unknown endpoint"}`,
      normalized,
    );

    if (normalized.status === 401) {
      await invalidateSession((error.config as SessionConfig | undefined)?.sessionIdentity ?? null);
    }

    // Reject with a normalized error object so thunks can extract message
    return Promise.reject(normalized);
  },
);

export default apiClient;
