import BaseAPI from "./base";
import type { IFinancialSummaryResponse } from "@/types/financialSummary/types";

class FinancialSummaryAPI extends BaseAPI {
  async fetchSummary({
    currentMonth,
    currentYear,
  }: {
    currentMonth: number;
    currentYear: number;
  }): Promise<IFinancialSummaryResponse> {
    return this.makeRequest<IFinancialSummaryResponse["data"]>(
      "/financial-summary",
      {
        method: "GET",
        params: { month: currentMonth, year: currentYear },
      },
    );
  }
}

export const financialSummaryAPI = new FinancialSummaryAPI();
export default financialSummaryAPI;
