import BaseAPI from "./base";
import type { IMonthlyInsightResponse } from "@/types/insight/types";

class InsightAPI extends BaseAPI {
  /**
   * AI-generated explanation of the given month, computed by the backend from
   * Fundleaf's authoritative report. Generation requires an explicit user action.
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
        method: "POST",
        data: { month: currentMonth, year: currentYear },
      },
    );
  }
}

export const insightAPI = new InsightAPI();
export default insightAPI;
