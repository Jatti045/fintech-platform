import BaseAPI from "./base";
import type { IMonthlyInsightResponse } from "@/types/insight/types";

class InsightAPI extends BaseAPI {
  /**
   * AI-generated explanation of the given month, computed by the backend from
   * Budgee's deterministic financial services. Cached per month by the API
   * slice; generation only happens when the user explicitly requests it.
   */
  async fetchMonthlyInsight({
    currentMonth,
    currentYear,
  }: {
    currentMonth: number;
    currentYear: number;
  }): Promise<IMonthlyInsightResponse> {
    return this.makeRequest<IMonthlyInsightResponse["data"]>(
      "/insights/monthly",
      {
        method: "GET",
        params: { month: currentMonth, year: currentYear },
      },
    );
  }
}

export const insightAPI = new InsightAPI();
export default insightAPI;
