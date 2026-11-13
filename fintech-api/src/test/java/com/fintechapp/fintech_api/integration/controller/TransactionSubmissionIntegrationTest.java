package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.ResultActions;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TransactionSubmissionIntegrationTest extends BaseIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    private User user;
    private Budget budget;

    @BeforeEach
    void setup() {
        user = createUser("submission-" + UUID.randomUUID() + "@example.com", "Password123!", "submitter");
        budget = createBudget(user, "Food", 100, Instant.parse("2026-03-01T00:00:00Z"));
        when(currencyConversionService.convert(12.5, "USD", "USD")).thenReturn(12.5);
    }

    @AfterEach
    void cleanup() {
        if (user != null) {
            jdbc.update("DELETE FROM transaction_submissions WHERE user_id = ?", user.getId());
            jdbc.update("DELETE FROM transactions WHERE user_id = ?", user.getId());
            jdbc.update("DELETE FROM budgets WHERE user_id = ?", user.getId());
            jdbc.update("DELETE FROM users WHERE id = ?", user.getId());
        }
    }

    @Test
    void createsAndReplaysExactlyTheOriginalResultAfterCommit() throws Exception {
        UUID id = UUID.randomUUID();
        // Each MockMvc call has its own committed service transaction. Discard the
        // first result as far as the caller is concerned, then retry the command.
        String committed = submit(id, "Lunch").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        assertEquals("Lunch", objectMapper.readTree(committed).at("/data/transaction/name").asText());
        String replay = submit(id, "Lunch").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        assertEquals(objectMapper.readTree(committed), objectMapper.readTree(replay));
        assertLedger(1, 12.5);
    }

    @Test
    void concurrentDuplicatesCommitOneTransactionAndBudgetContribution() throws Exception {
        UUID id = UUID.randomUUID();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<String> send = () -> {
                ready.countDown();
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return submit(id, "Lunch").andExpect(status().isCreated())
                        .andReturn().getResponse().getContentAsString();
            };
            var first = executor.submit(send);
            var second = executor.submit(send);
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(objectMapper.readTree(first.get(10, TimeUnit.SECONDS)),
                    objectMapper.readTree(second.get(10, TimeUnit.SECONDS)));
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
        assertLedger(1, 12.5);
    }

    @Test
    void rejectsChangedInputAndAllowsIndependentIdenticalTransactions() throws Exception {
        UUID firstId = UUID.randomUUID();
        submit(firstId, "Lunch").andExpect(status().isCreated());
        submit(firstId, "Different lunch").andExpect(status().isConflict());
        assertLedger(1, 12.5);
        submit(UUID.randomUUID(), "Lunch").andExpect(status().isCreated());
        assertLedger(2, 25);
        submit(firstId, "Lunch").andExpect(status().isCreated());
        assertLedger(2, 25);
    }

    @Test
    void replayAfterDeletionDoesNotRecreateTheTransaction() throws Exception {
        UUID submissionId = UUID.randomUUID();
        String created = submit(submissionId, "Lunch").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String transactionId = objectMapper.readTree(created).at("/data/transaction/id").asText();
        mockMvc.perform(delete("/api/transactions/{id}", transactionId)
                .header(authHeaderName(), authHeader(user))).andExpect(status().isOk());
        String replay = submit(submissionId, "Lunch").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        assertEquals(objectMapper.readTree(created), objectMapper.readTree(replay));
        assertLedger(0, 0);
    }

    private ResultActions submit(UUID id, String name) throws Exception {
        return mockMvc.perform(post("/api/transactions")
                .header(authHeaderName(), authHeader(user))
                .header("Idempotency-Key", id.toString())
                .contentType(json())
                .content(asJson(Map.of("name", name, "date", "2026-03-05T10:00:00Z",
                        "category", "Food", "type", "EXPENSE", "amount", 12.5, "budgetId", budget.getId()))));
    }

    private void assertLedger(int count, double spent) {
        assertEquals(count, jdbc.queryForObject("SELECT COUNT(*) FROM transactions WHERE user_id = ?",
                Integer.class, user.getId()));
        assertEquals(spent, budgetRepository.findById(budget.getId()).orElseThrow().getSpent(), 0.001);
    }
}
