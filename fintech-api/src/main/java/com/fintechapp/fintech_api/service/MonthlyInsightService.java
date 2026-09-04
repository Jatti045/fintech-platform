package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.fintechapp.fintech_api.ai.AiClientException;
import com.fintechapp.fintech_api.ai.AiCompletionClient;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.dto.insight.MonthlyFinancialContext;
import com.fintechapp.fintech_api.dto.insight.MonthlyFinancialContext.BudgetStatus;
import com.fintechapp.fintech_api.dto.insight.MonthlyFinancialContext.CategorySpend;
import com.fintechapp.fintech_api.dto.insight.MonthlyFinancialContext.RecurringChange;
import com.fintechapp.fintech_api.dto.insight.MonthlyInsightResponse;
import com.fintechapp.fintech_api.dto.insight.MonthlyInsightResponse.Data;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * Produces the "Explain my month" insight: a concise AI-generated explanation
 * layered on top of Budgee's deterministic financial data.
 *
 * <p>Every financial fact is computed by the existing services
 * ({@link FinancialSummaryService}, {@link BudgetService},
 * {@link RecurringPaymentService}, and the transaction repository's category
 * aggregation). This service only assembles the minimum structured context,
 * prompts the {@link AiCompletionClient} with it, and validates the response
 * shape. The AI never calculates financial facts.</p>
 */
@Service
public class MonthlyInsightService {

    /** Max categories sent to the provider (top current-month spend). */
    static final int MAX_CATEGORIES = 8;

    /** Max highlights accepted from the model. */
    static final int MAX_HIGHLIGHTS = 6;

    static final String INSUFFICIENT_DATA_SUMMARY =
            "There's not enough activity this month to generate a meaningful explanation yet.";

    static final String GENERATION_FAILED_MESSAGE =
            "Couldn't generate your monthly explanation right now.";


    private static final String SYSTEM_PROMPT = """
            You are Budgee's financial explanation assistant. You receive one JSON object \
            of financial facts that Budgee has already computed for the user's month: \
            income, expenses, net, per-category spending with the change versus the \
            previous month, budget usage, and recurring-payment price changes.

            Rules:
            - The context includes the month (1 = January … 12 = December) and its \
            monthName; always refer to the month by its monthName.
            - Use ONLY the supplied facts. Never invent, estimate, or calculate new numbers.
            - Explain the month in plain language: what changed, what is unusual, what is \
            going well, where spending increased, which budgets are at risk, and any \
            recurring-payment changes, when the facts support it.
            - Prioritize the most useful observations. Skip anything the facts do not cover.
            - Be concise and warm, like a helpful finance app. No generic financial advice. \
            No investment, tax, or legal advice. No predictions beyond the given data.

            Respond with ONLY a JSON object of this exact shape:
            {"summary": "2-4 sentences", "highlights": ["short bullet", "short bullet"]}
            """;

    private final AiCompletionClient aiClient;
    private final FinancialSummaryService financialSummaryService;
    private final BudgetService budgetService;
    private final RecurringPaymentService recurringPaymentService;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MonthlyInsightService(
            AiCompletionClient aiClient,
            FinancialSummaryService financialSummaryService,
            BudgetService budgetService,
            RecurringPaymentService recurringPaymentService,
            TransactionRepository transactionRepository,
            UserRepository userRepository) {
        this.aiClient = aiClient;
        this.financialSummaryService = financialSummaryService;
        this.budgetService = budgetService;
        this.recurringPaymentService = recurringPaymentService;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Generates the monthly explanation for the authenticated user.
     *
     * @param month zero-based month index (0 = January)
     */
    @Transactional(readOnly = true)
    public MonthlyInsightResponse generateForAuthenticatedUser(
            AuthenticatedUser authenticatedUser, int year, int month) {
        User user = requireUser(authenticatedUser);

        // Deterministic short-circuit: no AI request when the month is empty.
        FinancialSummaryData summary = financialSummaryService.resolveForMonth(user, year, month);
        boolean noActivity = summary.totalAmount() == 0 && summary.actualIncome() == 0;
        if (noActivity) {
            return new MonthlyInsightResponse(
                    true,
                    "Monthly insight generated",
                    new Data(year, month, user.getCurrency(), true,
                            INSUFFICIENT_DATA_SUMMARY, List.of()));
        }

        MonthlyFinancialContext context = buildContext(authenticatedUser, user, year, month, summary);
        Explanation explanation = callProvider(context);

        return new MonthlyInsightResponse(
                true,
                "Monthly insight generated",
                new Data(year, month, user.getCurrency(), false,
                        explanation.summary(), explanation.highlights()));
    }

    // ── Context assembly (deterministic facts only) ────────────────────────

    private MonthlyFinancialContext buildContext(
            AuthenticatedUser authenticatedUser,
            User user,
            int year,
            int month,
            FinancialSummaryData summary) {
        String userId = user.getId();
        Instant monthStart = financialSummaryService.monthStart(year, month);
        Instant nextMonthStart = financialSummaryService.monthStart(
                year + (month == 11 ? 1 : 0), (month + 1) % 12);
        Instant previousMonthStart = monthStart.minus(java.time.Duration.ofDays(
                java.time.LocalDate.ofInstant(monthStart, ZoneOffset.UTC)
                        .minusMonths(1).lengthOfMonth()));

        Map<String, Double> current = categoryTotals(userId, monthStart, nextMonthStart);
        Map<String, Double> previous = categoryTotals(userId, previousMonthStart, monthStart);

        List<CategorySpend> categories = current.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(MAX_CATEGORIES)
                .map(e -> new CategorySpend(
                        e.getKey(),
                        round2(e.getValue()),
                        previous.containsKey(e.getKey()) ? round2(previous.get(e.getKey())) : null,
                        previous.containsKey(e.getKey())
                                ? percentChange(e.getValue(), previous.get(e.getKey()))
                                : null))
                .toList();

        List<BudgetStatus> budgets = budgetService
                .getBudgets(authenticatedUser, String.valueOf(month), String.valueOf(year))
                .data().stream()
                .map(b -> new BudgetStatus(
                        b.category(),
                        round2(b.limit()),
                        round2(b.spent()),
                        b.limit() > 0 ? round2((b.spent() / b.limit()) * 100) : 0))
                .toList();

        List<RecurringChange> recurringChanges = recurringPaymentService
                .detectForAuthenticatedUser(authenticatedUser)
                .recurringPayments().stream()
                .map(item -> item.amountChange() == null ? null
                        : new RecurringChange(
                                item.name(),
                                item.amountChange().previousAmount(),
                                item.amountChange().currentAmount()))
                .filter(change -> change != null)
                .toList();

        return new MonthlyFinancialContext(
                year, month + 1, monthName(month), user.getCurrency(),
                round2(summary.monthlyIncome()),
                round2(summary.expectedIncome()),
                round2(summary.actualIncome()),
                round2(summary.totalAmount()),
                round2(summary.netRemaining()),
                round2(summary.spentPercentageOfIncome()),
                categories, budgets, recurringChanges);
    }

    private Map<String, Double> categoryTotals(String userId, Instant from, Instant to) {
        Map<String, Double> totals = new LinkedHashMap<>();
        for (TransactionRepository.CategoryTotal row : transactionRepository
                .sumAmountByUserAndTypeGroupedByCategory(userId, TransactionType.EXPENSE, from, to)) {
            if (StringUtils.hasText(row.getCategory())) {
                totals.put(row.getCategory(), row.getTotal() == null ? 0 : row.getTotal());
            }
        }
        return totals;
    }

    // ── AI call + response validation ──────────────────────────────────────

    record Explanation(String summary, List<String> highlights) {
    }

    private Explanation callProvider(MonthlyFinancialContext context) {
        String userContent;
        try {
            userContent = objectMapper.writeValueAsString(context);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, GENERATION_FAILED_MESSAGE);
        }

        try {
            String raw = aiClient.complete(SYSTEM_PROMPT, userContent);
            Explanation parsed = parseExplanation(raw);
            if (parsed == null || !StringUtils.hasText(parsed.summary())) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, GENERATION_FAILED_MESSAGE);
            }
            return parsed;
        } catch (AiClientException e) {
            // Coarse handling only — never surface or log provider payloads.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, GENERATION_FAILED_MESSAGE);
        }
    }

    /** Validates the model output; returns null when the shape is unusable. */
    Explanation parseExplanation(String raw) {
        if (raw == null) {
            return null;
        }
        String json = stripCodeFence(raw.trim());
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode summaryNode = node.get("summary");
            if (summaryNode == null || !summaryNode.isTextual() || summaryNode.asText().isBlank()) {
                return null;
            }
            List<String> highlights = new ArrayList<>();
            JsonNode highlightsNode = node.get("highlights");
            if (highlightsNode != null && highlightsNode.isArray()) {
                for (JsonNode h : highlightsNode) {
                    if (h.isTextual() && !h.asText().isBlank()) {
                        highlights.add(h.asText().trim());
                        if (highlights.size() >= MAX_HIGHLIGHTS) {
                            break;
                        }
                    }
                }
            }
            return new Explanation(summaryNode.asText().trim(), highlights);
        } catch (Exception e) {
            return null;
        }
    }

    private static String stripCodeFence(String raw) {
        if (raw.startsWith("```")) {
            int firstNewline = raw.indexOf('\n');
            int lastFence = raw.lastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline) {
                return raw.substring(firstNewline + 1, lastFence).trim();
            }
        }
        return raw;
    }

    private User requireUser(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return userRepository.findById(authenticatedUser.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));
    }

    private static Double percentChange(double current, double previous) {
        if (previous <= 0) {
            return null;
        }
        return round2(((current - previous) / previous) * 100);
    }

    /**
     * The single canonical zero-based → human-readable month conversion for
     * the AI boundary. Budgee's API month is 0-based (0 = January); the AI
     * must see 1 = January … 12 = December, spelled out.
     */
    private static String monthName(int zeroBasedMonth) {
        return java.time.Month.of(zeroBasedMonth + 1)
                .getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
