package com.fintechapp.fintech_api.integration.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.json.JsonCompareMode;

/**
 * End-to-end coverage for {@code GET /api/recurring-payments}: authentication, user isolation,
 * detection through the real repository path, and structural guarantees about what can never appear
 * as a bill.
 */
class RecurringPaymentIntegrationTest extends BaseIntegrationTest {

  /** First day of {@code monthsAgo} complete months before the current one. */
  private static Instant startOfMonthsAgo(int monthsAgo) {
    LocalDate today = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
    return today.minusMonths(monthsAgo).atStartOfDay().toInstant(ZoneOffset.UTC);
  }

  private void seedMonthlyRent(User user, int occurrences) {
    for (int i = 1; i <= occurrences; i++) {
      createTransaction(
          user, null, "Rent", startOfMonthsAgo(i), "RENT", TransactionType.EXPENSE, 1450.00);
    }
  }

  @Test
  void returnsExactWeeklySeriesInPredictionOrder() throws Exception {
    User user = createUser("recurring-order@example.com", "Password123!", "recurring-order");
    Instant today = Instant.now().truncatedTo(ChronoUnit.DAYS);
    String later = seedWeeklyAndExpectedJson(user, "Music", today.minus(1, ChronoUnit.DAYS));
    String earlier = seedWeeklyAndExpectedJson(user, "Gym", today.minus(3, ChronoUnit.DAYS));
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"success":true,"message":"Recurring payments retrieved successfully",
                     "data":{"recurringPayments":[%s,%s]}}
                    """
                        .formatted(earlier, later),
                    JsonCompareMode.STRICT));
  }

  private String seedWeeklyAndExpectedJson(User user, String name, Instant last) throws Exception {
    var matches = new ArrayList<Map<String, Object>>();
    for (int week = 3; week >= 0; week--) {
      Instant date = last.minus(week * 7L, ChronoUnit.DAYS);
      var transaction =
          createTransaction(user, null, name, date, "Bills", TransactionType.EXPENSE, 20);
      matches.add(Map.of("id", transaction.getId(), "date", date.toString(), "amount", 20));
    }
    return """
    {"seriesKey":"%s","name":"%s","expectedAmount":20,"currency":"USD","cadence":"WEEKLY",
     "intervalDays":7,"nextExpectedDate":"%s","lastOccurredDate":"%s","occurrences":4,
     "confidence":"HIGH","usualDayOfMonth":null,"amountChange":null,"matchedTransactions":%s}
    """
        .formatted(
            name.toUpperCase(java.util.Locale.ROOT),
            name,
            last.plus(7, ChronoUnit.DAYS),
            last,
            asJson(matches));
  }

  @Test
  void emptyHistoryPreservesTheExactSuccessEnvelope() throws Exception {
    User user = createUser("recurring-envelope@example.com", "Password123!", "recurring-envelope");
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"success":true,"message":"Recurring payments retrieved successfully",
                     "data":{"recurringPayments":[]}}
                    """,
                    JsonCompareMode.STRICT));
  }

  @Test
  void getRecurringPayments_noToken_returnsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/recurring-payments"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("No token provided."))
        .andExpect(jsonPath("$.fieldErrors").isEmpty())
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void getRecurringPayments_detectsMonthlySeriesWithPrediction() throws Exception {
    User user = createUser("recurring-detect@example.com", "Password123!", "recurring-detect");
    seedMonthlyRent(user, 6);

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)))
        .andExpect(jsonPath("$.data.recurringPayments[0].name").value("Rent"))
        .andExpect(jsonPath("$.data.recurringPayments[0].cadence").value("MONTHLY"))
        .andExpect(jsonPath("$.data.recurringPayments[0].confidence").value("HIGH"))
        .andExpect(jsonPath("$.data.recurringPayments[0].expectedAmount").value(1450.00))
        .andExpect(jsonPath("$.data.recurringPayments[0].occurrences").value(6))
        .andExpect(jsonPath("$.data.recurringPayments[0].usualDayOfMonth").isNumber())
        .andExpect(jsonPath("$.data.recurringPayments[0].seriesKey").isNotEmpty())
        .andExpect(jsonPath("$.data.recurringPayments[0].nextExpectedDate").isNotEmpty())
        .andExpect(jsonPath("$.data.recurringPayments[0].matchedTransactions").isArray());
  }

  @Test
  void getRecurringPayments_isIsolatedPerUser() throws Exception {
    User owner = createUser("recurring-owner@example.com", "Password123!", "recurring-owner");
    User other = createUser("recurring-other@example.com", "Password123!", "recurring-other");
    seedMonthlyRent(owner, 6);

    // Another user with no history sees nothing…
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(other)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));

    // …and the owner still sees their own series.
    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(owner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)));
  }

  @Test
  void getRecurringPayments_excludesTransfersAndIncome() throws Exception {
    // Rent series where every row is a transfer, plus a payroll income
    // series: neither may ever surface as an upcoming bill.
    User user = createUser("recurring-clean@example.com", "Password123!", "recurring-clean");
    for (int i = 1; i <= 6; i++) {
      var transfer =
          createTransaction(
              user, null, "Rent", startOfMonthsAgo(i), "RENT", TransactionType.EXPENSE, 1450.00);
      transfer.setTransfer(true);
      transactionRepository.save(transfer);

      createTransaction(
          user, null, "Payroll", startOfMonthsAgo(i), "INCOME", TransactionType.INCOME, 3200.00);
    }

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));
  }

  @Test
  void getRecurringPayments_emptyHistory_returnsEmptyList() throws Exception {
    User user = createUser("recurring-empty@example.com", "Password123!", "recurring-empty");

    mockMvc
        .perform(get("/api/recurring-payments").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.recurringPayments", hasSize(0)));
  }
}
