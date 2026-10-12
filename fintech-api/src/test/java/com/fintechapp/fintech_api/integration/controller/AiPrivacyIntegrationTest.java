package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.AiPrivacyService;
import com.fintechapp.fintech_api.service.FinancialSummaryService;
import com.fintechapp.fintech_api.service.MonthlyInsightService;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AiPrivacyIntegrationTest extends BaseIntegrationTest {
    @MockitoBean private AiCompletionClient provider;
    @MockitoBean private FinancialSummaryService summary;
    @Autowired private AiPrivacyService privacy;
    @Autowired private MonthlyInsightService insights;
    @Autowired private javax.sql.DataSource database;
    private User actor;
    private User victim;

    @BeforeEach
    void prepare() {
        actor = createUser("privacy-" + UUID.randomUUID() + "@example.com", "Password123!", "privacy");
        victim = createUser("victim-" + UUID.randomUUID() + "@example.com", "Password123!", "victim");
        when(summary.resolveForMonth(any(), anyInt(), anyInt())).thenReturn(
                new FinancialSummaryData(100, 1000, 1000, 1000, 100, 900, 10));
        when(summary.monthStart(anyInt(), anyInt())).thenAnswer(inv -> LocalDate.of(
                inv.getArgument(0), (Integer)inv.getArgument(1) + 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant());
        when(provider.complete(anyString(), anyString())).thenReturn("{\"summary\":\"Your month\",\"highlights\":[]}");
    }

    @AfterEach
    void cleanup() {
        if (actor != null) userRepository.deleteById(actor.getId());
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

    private static AuthenticatedUser auth(User user) {
        return new AuthenticatedUser(user.getId(), user.getEmail(), Instant.now().getEpochSecond());
    }
}
