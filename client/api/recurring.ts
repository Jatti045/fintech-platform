import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";
import type { IRecurringPaymentsResponseData } from "@/types/recurring/types";

/** Envelope returned by GET /api/recurring-payments. */
export type IRecurringPaymentsResponse =
  IApiResponse<IRecurringPaymentsResponseData>;

class RecurringAPI extends BaseAPI {
  /**
   * Detected upcoming bills, computed fresh server-side from the user's
   * expense history. `today` (client-local YYYY-MM-DD) is a cache-scope key
   * only — the backend always predicts against its own clock.
   */
  async fetchUpcoming(today: string): Promise<IRecurringPaymentsResponse> {
    return this.makeRequest<IRecurringPaymentsResponseData>(
      "/recurring-payments",
      { method: "GET", params: { today } },
    );
  }
}

export const recurringAPI = new RecurringAPI();
export default recurringAPI;