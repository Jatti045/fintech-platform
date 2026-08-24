import "axios";

/**
 * Augments Axios request configs with the app-level `meta` field.
 *
 * `meta.globalError` opts a request into the global error alert handled by
 * `config/apiErrorHandler.ts`. It is silent by default — see the policy
 * documented there. Example:
 *
 *   apiClient.post("/things", body, { meta: { globalError: true } })
 */
declare module "axios" {
  export interface AxiosRequestConfig {
    meta?: {
      /** Show the themed global alert if this request fails (default: false). */
      globalError?: boolean;
    };
  }
}
