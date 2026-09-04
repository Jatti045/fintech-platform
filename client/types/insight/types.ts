// ─── Monthly Insight (AI explanation) Domain Types ──────────────────────────
//
// The backend computes every financial fact deterministically and asks the AI
// provider only to *explain* them. The client renders the returned summary and
// highlights verbatim — it never parses raw model output.

export interface IMonthlyInsight {
  year: number;
  month: number;
  currency: string;
  /**
   * True when the month has too little activity for a meaningful explanation.
   * `summary` then holds a deterministic (non-AI) message to render as-is.
   */
  insufficientData: boolean;
  summary: string;
  highlights: string[];
}

/** Response envelope for GET /api/insights/monthly. */
export interface IMonthlyInsightResponse {
  success: boolean;
  message: string;
  data: IMonthlyInsight;
}
