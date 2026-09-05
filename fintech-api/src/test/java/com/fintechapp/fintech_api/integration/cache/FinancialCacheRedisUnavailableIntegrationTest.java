package com.fintechapp.fintech_api.integration.cache;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;

/**
 * Verifies that Budgee keeps working when Redis is unreachable: the configured
 * Redis port points at nothing, so every cache access fails. Financial reads
 * must fall back to PostgreSQL and mutations must still succeed — Redis is a
 * cache, never a hard dependency.
 */
@SpringBootTest(properties = "spring.data.redis.port=6390")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FinancialCacheRedisUnavailableIntegrationTest extends BaseIntegrationTest {

    @Test
    void financialSummary_servedFromPostgres_whenRedisIsUnavailable() throws Exception {
        User user = createUser("cache-down@example.com", "Password123!", "cache-down");
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);
        int month = utc.getMonthValue() - 1;
        int year = utc.getYear();
        Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Budget food = createBudget(user, "Food", 500, monthStart);
        createTransaction(user, food, "Groceries", monthStart.plusSeconds(3600), "Food",
                TransactionType.EXPENSE, 77.0);

        // Read falls through to PostgreSQL despite the dead cache.
        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalAmount").value(77.0));

        // Mutations are never blocked by cache failures (eviction attempts
        // fail silently); the next read still resolves through PostgreSQL.
        String payload = asJson(new FinancialCacheIntegrationTest.CreateTransactionPayload(
                "Dinner", utc.toString(), "Food", "EXPENSE", 23.0, food.getId()));
        mockMvc.perform(post("/api/transactions")
                        .header(authHeaderName(), authHeader(user))
                        .contentType(json())
                        .content(payload))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/financial-summary")
                        .header(authHeaderName(), authHeader(user))
                        .param("month", String.valueOf(month))
                        .param("year", String.valueOf(year)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalAmount").value(100.0));
    }
}
