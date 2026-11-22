package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MonthlyIncomeReadIntegrationTest extends BaseIntegrationTest {
  private static final String ROUTE = "/api/users/me/monthly-income";

  @Test
  void incomeUsesOwnerScopedBaselinesAndHalfOpenUtcAggregation() throws Exception {
    var owner = createUser("income-read-owner@example.com", "Password123!", "income-owner");
    var other = createUser("income-read-other@example.com", "Password123!", "income-other");
    var from = Instant.parse("2024-02-01T00:00:00Z");
    var to = Instant.parse("2024-03-01T00:00:00Z");
    createMonthlyIncome(owner, Instant.parse("2023-12-01T00:00:00Z"), 325.125);
    createMonthlyIncome(owner, to, 0);
    createMonthlyIncome(owner, Instant.parse("2024-04-01T00:00:00Z"), 900);
    createMonthlyIncome(other, from, 800);
    transaction(owner, from.minusSeconds(1), TransactionType.INCOME, 40);
    transaction(owner, from, TransactionType.INCOME, 100.125);
    transaction(owner, to.minusSeconds(1), TransactionType.INCOME, 25.25);
    transaction(owner, to, TransactionType.INCOME, 31);
    transaction(owner, from, TransactionType.EXPENSE, 87);
    var transfer = transaction(owner, from, TransactionType.INCOME, 70);
    transfer.setTransfer(true);
    transactionRepository.save(transfer);
    transaction(other, from, TransactionType.INCOME, 800);

    var json =
        objectMapper.readTree(
            mockMvc
                .perform(
                    get(ROUTE)
                        .header(authHeaderName(), authHeader(owner))
                        .param("month", " 01 ")
                        .param("year", "2024"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertEquals(List.of("success", "message", "data"), List.copyOf(json.propertyNames()));
    assertTrue(json.get("success").asBoolean());
    assertEquals("Monthly income fetched successfully.", json.get("message").asString());
    var data = json.get("data");
    assertEquals(
        List.of(
            "id",
            "username",
            "email",
            "profilePic",
            "currency",
            "setupComplete",
            "monthlyIncome",
            "actualMonthlyIncome",
            "createdAt",
            "updatedAt"),
        List.copyOf(data.propertyNames()));
    assertEquals(owner.getId(), data.get("id").asString());
    assertEquals(owner.getUsername(), data.get("username").asString());
    assertEquals(owner.getEmail(), data.get("email").asString());
    assertEquals(owner.getCurrency(), data.get("currency").asString());
    assertTrue(data.get("profilePic").isNull());
    assertFalse(data.get("setupComplete").asBoolean());
    Instant.parse(data.get("createdAt").asString());
    Instant.parse(data.get("updatedAt").asString());
    assertEquals(325.125, data.get("monthlyIncome").asDouble());
    assertEquals(125.375, data.get("actualMonthlyIncome").asDouble());
    income(owner, "10", "2023", 0, 0);
    income(owner, "0", "2024", 325.125, 40);
    income(owner, "2", "2024", 0, 31);
    income(owner, "3", "2024", 900, 0);
  }

  @Test
  void rejectsMissingAuthenticationAndInvalidPeriods() throws Exception {
    var owner = createUser("income-read-errors@example.com", "Password123!", "income-errors");
    mockMvc
        .perform(get(ROUTE))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("No token provided."));
    mockMvc
        .perform(get(ROUTE).header(authHeaderName(), "invalid"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Invalid token format."));
    mockMvc
        .perform(get(ROUTE).header(authHeaderName(), authHeader(owner)).param("month", "1"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.message").value("An unexpected error occurred."));
    mockMvc
        .perform(get(ROUTE).header(authHeaderName(), authHeader(owner)).param("year", "2024"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.message").value("An unexpected error occurred."));
    for (String[] period :
        List.of(
            new String[] {"12", "2024"},
            new String[] {"-1", "2024"},
            new String[] {"1.0", "2024"},
            new String[] {"1", "0"},
            new String[] {"1", "2147483648"})) {
      mockMvc
          .perform(
              get(ROUTE)
                  .header(authHeaderName(), authHeader(owner))
                  .param("month", period[0])
                  .param("year", period[1]))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.message").value("Month and year query parameters are required"));
    }
  }

  @Test
  void deletedOwnerInvalidatesAnOtherwiseValidToken() throws Exception {
    var owner = createUser("income-read-deleted@example.com", "Password123!", "income-deleted");
    String token = authHeader(owner);
    userRepository.deleteById(owner.getId());
    mockMvc
        .perform(
            get(ROUTE).header(authHeaderName(), token).param("month", "1").param("year", "2024"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Session has been revoked. Please sign in again."));
  }

  private com.fintechapp.fintech_api.model.Transaction transaction(
      User owner, Instant date, TransactionType type, double amount) {
    return createTransaction(
        owner, null, "income read fixture", date, "Uncategorized", type, amount);
  }

  private void income(User owner, String month, String year, double expected, double actual)
      throws Exception {
    mockMvc
        .perform(
            get(ROUTE)
                .header(authHeaderName(), authHeader(owner))
                .param("month", month)
                .param("year", year))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(expected))
        .andExpect(jsonPath("$.data.actualMonthlyIncome").value(actual));
  }
}
