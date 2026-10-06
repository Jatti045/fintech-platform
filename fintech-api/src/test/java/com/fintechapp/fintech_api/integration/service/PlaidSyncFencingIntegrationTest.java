package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.*;
import tools.jackson.databind.JsonNode;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PlaidSyncFencingIntegrationTest extends BaseIntegrationTest {
    @Autowired private PlaidItemRepository items;
    @Autowired private PlaidSyncLockService leases;
    @Autowired private PlaidTransactionIngestService ingest;
    @Autowired private FinancialCacheInvalidator cache;
    @Autowired private InternalTransferReconciliationService transfers;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void expiredWorkerCannotApplyOldPageAfterAnotherWorkerCommits() throws Exception {
        PlaidItem item = createItem();
        var pool = Executors.newSingleThreadExecutor();
        CountDownLatch fetched = new CountDownLatch(1);
        CountDownLatch resume = new CountDownLatch(1);
        try {
            assertTrue(leases.tryAcquire(item.getItemId(), "L1", Duration.ofMinutes(5)));
            PlaidService workerA = service(() -> {
                fetched.countDown();
                assertTrue(resume.await(10, TimeUnit.SECONDS));
                return payload("C1", """
                        "added":[{"transaction_id":"ghost","amount":999,"date":"2026-10-01"}],
                        "modified":[{"transaction_id":"kept","amount":999,"date":"2026-10-01"}],
                        "removed":[{"transaction_id":"removable"}]
                        """);
            }, "C0");
            var stale = pool.submit(() -> workerA.fetchAndApplySyncPage(item.getItemId(), "L1"));
            assertTrue(fetched.await(10, TimeUnit.SECONDS));
            expire(item);
            assertFalse(leases.extend(item.getItemId(), "L1", Duration.ofMinutes(5)),
                    "An expired lease must not be resurrected by renewal");
            assertTrue(leases.tryAcquire(item.getItemId(), "L2", Duration.ofMinutes(5)));
            service(() -> payload("C2", """
                    "added":[{"transaction_id":"kept","amount":20,"date":"2026-10-01"},
                             {"transaction_id":"removable","amount":30,"date":"2026-10-01"}],
                    "modified":[],"removed":[]
                    """), "C0").fetchAndApplySyncPage(item.getItemId(), "L2");
            var financialState = financialState(item);
            PlaidItem newer = items.findById(item.getId()).orElseThrow();
            assertEquals(2, transactionRepository.findByPlaidTransactionIdInAndUser_Id(
                    List.of("kept", "removable"), item.getUser().getId()).size());
            resume.countDown();
            assertInstanceOf(StalePlaidSyncPageException.class,
                    assertThrows(ExecutionException.class, () -> stale.get(10, TimeUnit.SECONDS)).getCause());
            assertEquals(financialState, financialState(item));
            PlaidItem current = items.findById(item.getId()).orElseThrow();
            assertEquals("C2", current.getCursor());
            assertEquals("L2", current.getSyncLockToken());
            assertEquals(newer.getSyncLockExpiresAt(), current.getSyncLockExpiresAt());
            assertEquals(newer.getLastSyncedAt(), current.getLastSyncedAt());
            assertFalse(current.isSyncError());
            assertFalse(leases.release(item.getItemId(), "L1"));
            // The current owner can continue fetching from the committed cursor.
            service(() -> payload("C3", "\"added\":[],\"modified\":[],\"removed\":[]"), "C2")
                    .fetchAndApplySyncPage(item.getItemId(), "L2");
            assertEquals("C3", items.findById(item.getId()).orElseThrow().getCursor());
        } finally {
            resume.countDown();
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
            cleanup(item);
        }
    }

    @Test
    void cursorMismatchRejectsPageEvenWithValidLease() throws Exception {
        PlaidItem item = createItem();
        try {
            assertTrue(leases.tryAcquire(item.getItemId(), "L1", Duration.ofMinutes(5)));
            var before = financialState(item);
            PlaidService worker = service(() -> {
                jdbc.update("UPDATE plaid_items SET cursor = 'C2' WHERE id = ?", item.getId());
                return payload("C1", "\"added\":[{\"transaction_id\":\"ghost\",\"amount\":99,\"date\":\"2026-10-01\"}],\"modified\":[],\"removed\":[]");
            }, "C0");
            assertThrows(StalePlaidSyncPageException.class,
                    () -> worker.fetchAndApplySyncPage(item.getItemId(), "L1"));
            assertEquals(before, financialState(item));
            PlaidItem current = items.findById(item.getId()).orElseThrow();
            assertEquals("C2", current.getCursor());
            assertEquals("L1", current.getSyncLockToken());
            assertTrue(current.getSyncLockExpiresAt().isAfter(Instant.now()));
        } finally {
            cleanup(item);
        }
    }

    @Test
    void replacementLeaseRejectsPageEvenWithUnchangedCursor() throws Exception {
        PlaidItem item = createItem();
        try {
            assertTrue(leases.tryAcquire(item.getItemId(), "L1", Duration.ofMinutes(5)));
            var before = financialState(item);
            PlaidService worker = service(() -> {
                assertTrue(leases.release(item.getItemId(), "L1"));
                assertTrue(leases.tryAcquire(item.getItemId(), "L2", Duration.ofMinutes(5)));
                return payload("C1", "\"added\":[{\"transaction_id\":\"ghost\",\"amount\":99,\"date\":\"2026-10-01\"}],\"modified\":[],\"removed\":[]");
            }, "C0");
            assertThrows(StalePlaidSyncPageException.class,
                    () -> worker.fetchAndApplySyncPage(item.getItemId(), "L1"));
            assertEquals(before, financialState(item));
            PlaidItem current = items.findById(item.getId()).orElseThrow();
            assertEquals("C0", current.getCursor());
            assertEquals("L2", current.getSyncLockToken());
        } finally {
            cleanup(item);
        }
    }

    @Test
    void expiredLeaseRejectsPageWithoutReplacementOwner() throws Exception {
        PlaidItem item = createItem();
        try {
            assertTrue(leases.tryAcquire(item.getItemId(), "L1", Duration.ofMinutes(5)));
            var before = financialState(item);
            PlaidService worker = service(() -> {
                expire(item);
                return payload("C1", "\"added\":[{\"transaction_id\":\"ghost\",\"amount\":99,\"date\":\"2026-10-01\"}],\"modified\":[],\"removed\":[]");
            }, "C0");
            assertThrows(StalePlaidSyncPageException.class,
                    () -> worker.fetchAndApplySyncPage(item.getItemId(), "L1"));
            assertEquals(before, financialState(item));
            assertEquals("C0", items.findById(item.getId()).orElseThrow().getCursor());
        } finally {
            cleanup(item);
        }
    }

    private PlaidItem createItem() {
        User user = createUser("fence-" + UUID.randomUUID() + "@example.com", "Password123!", "FenceTest");
        return new TransactionTemplate(transactionManager).execute(status -> {
            PlaidItem item = new PlaidItem();
            item.setUser(user);
            item.setItemId("fence-" + UUID.randomUUID());
            item.setAccessTokenEncrypted("encrypted");
            item.setCursor("C0");
            return items.saveAndFlush(item);
        });
    }

    private void expire(PlaidItem item) {
        jdbc.update("UPDATE plaid_items SET sync_lock_expires_at = ? WHERE id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), item.getId());
    }

    private JsonNode payload(String cursor, String changes) throws Exception {
        return objectMapper.readTree("{" + changes + ",\"next_cursor\":\"" + cursor + "\",\"has_more\":false}");
    }

    private PlaidService service(Callable<JsonNode> response, String expectedCursor) {
        RestClient client = mock(RestClient.class);
        RestClient.RequestBodyUriSpec post = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec body = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec result = mock(RestClient.ResponseSpec.class);
        when(client.post()).thenReturn(post);
        when(post.uri(anyString())).thenReturn(body);
        when(body.contentType(any(MediaType.class))).thenReturn(body);
        when(body.body(any(Object.class))).thenAnswer(inv -> {
            assertEquals(expectedCursor, ((Map<?, ?>) inv.getArgument(0)).get("cursor"));
            return body;
        });
        when(body.retrieve()).thenReturn(result);
        when(result.body(JsonNode.class)).thenAnswer(inv -> response.call());
        EncryptionService encryption = mock(EncryptionService.class);
        when(encryption.decrypt("encrypted")).thenReturn("access-token");
        return new PlaidService(client, new PlaidSettings("client", "secret", "https://sandbox.plaid.com",
                "https://example.com/webhook", List.of("US"), "en"), encryption, items, userRepository,
                ingest, cache, transfers, Optional.of(transactionManager));
    }

    private List<List<Map<String, Object>>> financialState(PlaidItem item) {
        String userId = item.getUser().getId();
        return List.of(jdbc.queryForList("SELECT * FROM transactions WHERE user_id = ? ORDER BY id", userId),
                jdbc.queryForList("SELECT * FROM budgets WHERE user_id = ? ORDER BY id", userId),
                jdbc.queryForList("SELECT * FROM user_monthly_incomes WHERE user_id = ? ORDER BY id", userId));
    }

    private void cleanup(PlaidItem item) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            transactionRepository.deleteByUser_Id(item.getUser().getId());
            budgetRepository.deleteByUser_Id(item.getUser().getId());
            userMonthlyIncomeRepository.deleteByUser_Id(item.getUser().getId());
            items.deleteByUser_Id(item.getUser().getId());
            userRepository.deleteById(item.getUser().getId());
        });
    }
}
