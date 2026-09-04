package com.fintechapp.fintech_api.dto.insight;

import java.util.List;

/**
 * Response for GET /api/insights/monthly. When {@code insufficientData} is
 * true, {@code summary} holds a deterministic (non-AI) explanation and the
 * client should render it as-is.
 */
public record MonthlyInsightResponse(boolean success, String message, Data data) {

    public record Data(
            int year,
            int month,
            String currency,
            boolean insufficientData,
            String summary,
            List<String> highlights) {
    }
}
