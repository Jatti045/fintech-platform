package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidSyncJobService;

class PlaidSyncJobServiceIntegrationTest extends BaseIntegrationTest {
    @Autowired private PlaidSyncJobService jobs;
    @Autowired private PlaidItemRepository items;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void duplicateRequestsCoalesceAndArrivalDuringSyncSchedulesOneFollowUp() {
        String itemId = createItem();
        assertEquals("QUEUED", jobs.requestSync(itemId, false).status());
        jobs.requestSync(itemId, false);
        assertEquals(1L, version(itemId));

        PlaidSyncJobService.JobClaim first = jobs.claimNext().orElseThrow();
        jobs.requestSync(itemId, false);
        jobs.requestSync(itemId, false);
        assertEquals(2L, version(itemId));
        assertTrue(jobs.complete(first));
        assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());

        PlaidSyncJobService.JobClaim followUp = jobs.claimNext().orElseThrow();
        assertEquals(2L, followUp.claimedVersion());
        assertTrue(jobs.complete(followUp));
        assertEquals("SUCCEEDED", jobs.statusForItem(itemId).orElseThrow().status());
    }

    @Test
    void expiredLeaseCanBeReclaimedAndOldOwnerCannotComplete() {
        String itemId = createItem();
        jobs.requestSync(itemId, false);
        PlaidSyncJobService.JobClaim oldOwner = jobs.claimNext().orElseThrow();
        jdbc.update("UPDATE plaid_sync_jobs SET lease_expires_at=? WHERE item_id=?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(10)), itemId);

        PlaidSyncJobService.JobClaim newOwner = jobs.claimNext().orElseThrow();
        assertNotEquals(oldOwner.owner(), newOwner.owner());
        assertEquals(2, newOwner.attemptCount());
        assertFalse(jobs.complete(oldOwner));
        assertTrue(jobs.complete(newOwner));
    }

    @Test
    void retriesArePersistedWithBackoffAndTerminalFailuresRemainVisible() {
        String itemId = createItem();
        jobs.requestSync(itemId, false);
        PlaidSyncJobService.JobClaim claim = jobs.claimNext().orElseThrow();
        assertTrue(jobs.retry(claim, "PLAID_UNAVAILABLE"));
        assertEquals("RETRYING", jobs.statusForItem(itemId).orElseThrow().status());
        assertTrue(jobs.statusForItem(itemId).orElseThrow().nextAttemptAt().isAfter(Instant.now()));
        assertEquals("PLAID_UNAVAILABLE", jdbc.queryForObject(
                "SELECT last_error_code FROM plaid_sync_jobs WHERE item_id=?", String.class, itemId));
    }

    @Test
    void retryExhaustionBecomesTerminalAndManualRequestReopensTheJob() {
        String itemId = createItem();
        jobs.requestSync(itemId, false);
        for (int attempt = 1; attempt <= 8; attempt++) {
            PlaidSyncJobService.JobClaim claim = jobs.claimNext().orElseThrow();
            assertEquals(attempt, claim.attemptCount());
            assertTrue(jobs.retry(claim, "PLAID_UNAVAILABLE"));
            if (attempt < 8) jdbc.update("UPDATE plaid_sync_jobs SET next_attempt_at=NOW() WHERE item_id=?", itemId);
        }
        assertEquals("FAILED", jobs.statusForItem(itemId).orElseThrow().status());
        assertEquals("QUEUED", jobs.requestSync(itemId, true).status());
    }

    @Test
    void staleActiveItemIsReconciledAndDisconnectedItemDropsItsJob() {
        String itemId = createItem();
        jdbc.update("UPDATE plaid_items SET last_synced_at=? WHERE item_id=?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(48 * 3600L)), itemId);
        jobs.reconcileStaleItems();
        assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());
        jdbc.update("DELETE FROM plaid_items WHERE item_id=?", itemId);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM plaid_sync_jobs WHERE item_id=?", Integer.class, itemId));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentWorkerInstancesClaimOnlyOneCopyOfAJob() throws Exception {
        String itemId = createItem();
        jobs.requestSync(itemId, false);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> { start.await(); return jobs.claimNext(); });
            var second = pool.submit(() -> { start.await(); return jobs.claimNext(); });
            start.countDown();
            List<PlaidSyncJobService.JobClaim> claims = java.util.Arrays.asList(
                    first.get(10, TimeUnit.SECONDS).orElse(null), second.get(10, TimeUnit.SECONDS).orElse(null))
                    .stream().filter(java.util.Objects::nonNull).toList();
            assertEquals(1, claims.size());
            assertEquals(itemId, claims.get(0).itemId());
        } finally {
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS));
            items.findByItemId(itemId).ifPresent(items::delete);
        }
    }

    private String createItem() {
        var user = createUser("plaid-job-" + UUID.randomUUID() + "@example.com", "Password123!", "job-test");
        PlaidItem item = new PlaidItem();
        item.setUser(user);
        item.setItemId("job-item-" + UUID.randomUUID());
        item.setAccessTokenEncrypted("ciphertext");
        return items.saveAndFlush(item).getItemId();
    }

    private long version(String itemId) {
        return jdbc.queryForObject("SELECT requested_version FROM plaid_sync_jobs WHERE item_id=?", Long.class, itemId);
    }
}
