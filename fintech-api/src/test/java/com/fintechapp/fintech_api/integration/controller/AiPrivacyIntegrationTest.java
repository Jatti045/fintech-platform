package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.ai.AiCompletionClient;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.UpdateAiPrivacyRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.AiPrivacyService;
import com.fintechapp.fintech_api.service.MonthlyInsightService;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AiPrivacyIntegrationTest extends BaseIntegrationTest {
    @MockitoBean private AiCompletionClient provider;

    @Autowired private AiPrivacyService privacy;
    @Autowired private MonthlyInsightService insights;
    @Autowired private javax.sql.DataSource database;
    @Autowired private org.springframework.transaction.PlatformTransactionManager manager;
    private User actor;
    private User victim;

    @BeforeEach
    void prepare() {
        actor = createUser("privacy-" + UUID.randomUUID() + "@example.com", "Password123!", "privacy");
        victim = createUser("victim-" + UUID.randomUUID() + "@example.com", "Password123!", "victim");
        createTransaction(actor, null, "Historical expense", Instant.parse("2026-09-05T00:00:00Z"),
                "Food", com.fintechapp.fintech_api.model.TransactionType.EXPENSE, 100);
        when(provider.complete(anyString(), anyString())).thenReturn("{\"summary\":\"Your month\",\"highlights\":[]}");
    }

    @AfterEach
    void cleanup() {
        if (actor != null) {
            new org.springframework.transaction.support.TransactionTemplate(manager).executeWithoutResult(status -> {
                transactionRepository.deleteByUser_Id(actor.getId());
                userRepository.deleteById(actor.getId());
            });
        }
        if (victim != null) userRepository.deleteById(victim.getId());
    }

    @Test
    void migrationKeepsPreexistingAccountsDisabledAndIsIdempotent() throws Exception {
        try (var connection = database.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE TEMP TABLE legacy_ai_migration (id TEXT PRIMARY KEY) ON COMMIT DROP");
                statement.execute("INSERT INTO legacy_ai_migration VALUES ('existing-account')");
                String migration;
                try (var resource = getClass().getResourceAsStream("/db/migration/V23__ai_processing_consent.sql")) {
                    assertNotNull(resource);
                    migration = new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                            .replace("ALTER TABLE users", "ALTER TABLE legacy_ai_migration");
                }
                statement.execute(migration);
                statement.execute(migration);
                try (var rows = statement.executeQuery("SELECT ai_processing_enabled, ai_consent_version, ai_consent_updated_at FROM legacy_ai_migration")) {
                    assertTrue(rows.next());
                    assertFalse(rows.getBoolean(1));
                    assertNull(rows.getString(2));
                    assertNull(rows.getTimestamp(3));
                }
            } finally { connection.rollback(); }
        }
    }

    @Test
    void accountsDefaultDisabledAndUnauthenticatedChangesAreRejected() throws Exception {
        mockMvc.perform(get("/api/users/me/ai-preference").header(authHeaderName(), authHeader(actor)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(false));
        mockMvc.perform(patch("/api/users/me/ai-preference").contentType(json()).content("{\"enabled\":true,\"disclosureVersion\":\"1\"}"))
                .andExpect(status().isUnauthorized());
        assertFalse(userRepository.findById(actor.getId()).orElseThrow().isAiProcessingEnabled());
        verify(provider, never()).complete(anyString(), anyString());
    }

    @Test
    void consentIsExplicitAccountScopedAndEnforcedBeforeProviderCalls() throws Exception {
        AuthenticatedUser auth = auth(actor);
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> insights.generateForAuthenticatedUser(auth, 2026, 8)).getStatusCode().value());
        mockMvc.perform(patch("/api/users/me/ai-preference").header(authHeaderName(), authHeader(actor))
                .contentType(json()).content("{\"enabled\":true}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/users/me/ai-preference").header(authHeaderName(), authHeader(actor))
                .contentType(json()).content("{\"enabled\":true,\"disclosureVersion\":\"1\",\"userId\":\"" + victim.getId() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.enabled").value(true));
        assertFalse(userRepository.findById(victim.getId()).orElseThrow().isAiProcessingEnabled());
        insights.generateForAuthenticatedUser(auth, 2026, 8);
        verify(provider, times(1)).complete(anyString(), anyString());
        privacy.update(auth, new UpdateAiPrivacyRequest(false, null));
        assertThrows(ResponseStatusException.class, () -> insights.generateForAuthenticatedUser(auth, 2026, 8));
        verify(provider, times(1)).complete(anyString(), anyString());
    }

    @Test
    void optOutSerializesWithAnInFlightRequestAcrossDatabaseTransactions() throws Exception {
        privacy.update(auth(actor), new UpdateAiPrivacyRequest(true, "1"));
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(provider.complete(anyString(), anyString())).thenAnswer(inv -> {
            entered.countDown();
            assertTrue(release.await(10, TimeUnit.SECONDS));
            return "{\"summary\":\"Your month\",\"highlights\":[]}";
        });
        var pool = Executors.newFixedThreadPool(2);
        try {
            var generation = pool.submit(() -> insights.generateForAuthenticatedUser(auth(actor), 2026, 8));
            assertTrue(entered.await(10, TimeUnit.SECONDS));
            CountDownLatch changing = new CountDownLatch(1);
            var optOut = pool.submit(() -> { changing.countDown(); return privacy.update(auth(actor), new UpdateAiPrivacyRequest(false, null)); });
            assertTrue(changing.await(5, TimeUnit.SECONDS));
            assertThrows(java.util.concurrent.TimeoutException.class, () -> optOut.get(100, TimeUnit.MILLISECONDS));
            release.countDown();
            generation.get(10, TimeUnit.SECONDS);
            assertFalse(optOut.get(10, TimeUnit.SECONDS).data().enabled());
            assertThrows(ResponseStatusException.class, () -> insights.generateForAuthenticatedUser(auth(actor), 2026, 8));
            verify(provider, times(1)).complete(anyString(), anyString());
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }

    @Test
    void postAndLegacyGetUseTheSameHistoricalReportWithOffsettingRefunds() throws Exception {
        new org.springframework.transaction.support.TransactionTemplate(manager).executeWithoutResult(status -> {
            transactionRepository.deleteByUser_Id(actor.getId());
            var date = Instant.parse("2026-09-05T00:00:00Z");
            var type = com.fintechapp.fintech_api.model.TransactionType.EXPENSE;
            createTransaction(actor, null, "Purchase", date, "Food", type, 20.005);
            createTransaction(actor, null, "Refund", date.plusSeconds(1), "Food", type, -20.005);
            createTransaction(actor, null, "Outside requested month", date.plusSeconds(40 * 86400L), "Other", type, 300);
        });
        String path = "/api/insights/monthly";
        mockMvc.perform(post(path).header(authHeaderName(), authHeader(actor)).contentType(json())
                .content("{\"year\":2026,\"month\":8}")).andExpect(status().isForbidden());
        privacy.update(auth(actor), new UpdateAiPrivacyRequest(true, "1"));

        mockMvc.perform(post(path)
                .header(authHeaderName(), authHeader(actor)).contentType(json())
                .content("{\"year\":2026,\"month\":12}")).andExpect(status().isBadRequest());
        mockMvc.perform(post(path)
                .header(authHeaderName(), authHeader(actor)).contentType(json())
                .content("{\"year\":2026}")).andExpect(status().isBadRequest());
        mockMvc.perform(post(path).header(authHeaderName(), authHeader(actor)).contentType(json())
                .content("{\"year\":2026,\"month\":8.5}")).andExpect(status().isBadRequest());
        mockMvc.perform(get(path).header(authHeaderName(), authHeader(actor)).param("year", "2026").param("month", "-1"))
                .andExpect(status().isBadRequest());
        verify(provider, never()).complete(anyString(), anyString());

        String reportBody = mockMvc.perform(get("/api/financial-summary/report")
                .header(authHeaderName(), authHeader(actor)).param("year", "2026").param("month", "8"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String response = mockMvc.perform(post(path)
                .header(authHeaderName(), authHeader(actor)).contentType(json())
                .content("{\"year\":2026,\"month\":8}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.insufficientData").value(false))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        verify(provider, times(1)).complete(anyString(), anyString());
        String legacy = mockMvc.perform(get(path).header(authHeaderName(), authHeader(actor))
                .param("year", "2026").param("month", "8")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        assertEquals(objectMapper.readTree(response), objectMapper.readTree(legacy));

        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(provider, times(2)).complete(anyString(), payload.capture());
        assertEquals(payload.getAllValues().get(0), payload.getAllValues().get(1));
        var facts = objectMapper.readTree(payload.getValue());
        var report = objectMapper.readTree(reportBody).path("data");
        assertEquals(0.0, facts.path("expenses").asDouble());
        assertEquals(20.01, facts.path("grossExpenses").asDouble());
        assertEquals(report.path("grossExpenses"), facts.path("grossExpenses"));
        assertEquals(report.path("expenseCredits"), facts.path("expenseCredits"));
        assertEquals(report.at("/categories/0/netSpent"), facts.at("/categories/0/total"));
        assertEquals(1, facts.path("categories").size());
        assertFalse(facts.has("recurringChanges"));
    }

    private static AuthenticatedUser auth(User user) {
        return new AuthenticatedUser(user.getId(), user.getEmail(), Instant.now().getEpochSecond());
    }
}
