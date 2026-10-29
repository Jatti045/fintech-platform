package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.Future;
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
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;

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

        assertTrue(jobs.claimNext().isEmpty());
        makeReady(itemId);
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
            cleanupItem(itemId);
        }
    }

    @Test
    void immediatePostSuccessWebhookIsPersistedAndRunsAfterAFixedDebounceDeadline() {
        String itemId = createItem();
        jobs.requestSync(itemId, false);
        var first = jobs.claimNext().orElseThrow();
        assertTrue(jobs.complete(first));
        Instant successAt = jdbc.queryForObject("SELECT last_success_at FROM plaid_sync_jobs WHERE item_id=?",
                java.sql.Timestamp.class, itemId).toInstant();
        var queued = jobs.requestSync(itemId, false);
        assertEquals("QUEUED", queued.status()); assertEquals(2L, version(itemId));
        assertEquals(successAt.plusSeconds(30), queued.nextAttemptAt());
        assertTrue(jobs.claimNext().isEmpty());
        for (int i = 0; i < 10; i++) {
            var duplicate = jobs.requestSync(itemId, false);
            assertEquals(queued.nextAttemptAt(), duplicate.nextAttemptAt());
            assertEquals(2L, version(itemId));
        }
        makeReady(itemId);
        var followUp = jobs.claimNext().orElseThrow();
        assertEquals(2, followUp.claimedVersion()); assertEquals(1, followUp.attemptCount());
        assertTrue(jobs.complete(followUp)); assertTrue(jobs.claimNext().isEmpty());
    }

    @Test
    void moreThanEightSuccessfulFollowUpGenerationsNeverExhaustTheFailureBudget() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        for (int generation = 1; generation <= 12; generation++) {
            makeReady(itemId);
            var claim = jobs.claimNext().orElseThrow();
            assertEquals(generation, claim.claimedVersion()); assertEquals(1, claim.attemptCount());
            if (generation < 12) {
                jobs.requestSync(itemId, false); jobs.requestSync(itemId, false);
            }
            assertTrue(jobs.complete(claim));
            var status = jobs.statusForItem(itemId).orElseThrow();
            assertEquals(0, status.attemptCount());
            assertEquals(generation < 12 ? "QUEUED" : "SUCCEEDED", status.status());
        }
        assertTrue(jobs.claimNext().isEmpty());
    }

    @Test
    void successfulRetryResetsFailuresEvenWhenAnotherGenerationIsPending() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        var first = jobs.claimNext().orElseThrow(); assertTrue(jobs.retry(first, "TEMPORARY"));
        Instant retryAt = jobs.statusForItem(itemId).orElseThrow().nextAttemptAt();
        for (int i = 0; i < 5; i++) {
            var status = jobs.requestSync(itemId, false);
            assertEquals("RETRYING", status.status()); assertEquals(1, status.attemptCount());
            assertEquals(retryAt, status.nextAttemptAt());
        }
        makeReady(itemId); var retry = jobs.claimNext().orElseThrow(); assertEquals(2, retry.attemptCount());
        jobs.requestSync(itemId, false); assertTrue(jobs.complete(retry));
        assertEquals(0, jobs.statusForItem(itemId).orElseThrow().attemptCount());
        assertTrue(jobs.claimNext().isEmpty()); makeReady(itemId);
        var next = jobs.claimNext().orElseThrow(); assertEquals(1, next.attemptCount());
        assertTrue(jobs.retry(next, "TEMPORARY"));
        Instant delay = jobs.statusForItem(itemId).orElseThrow().nextAttemptAt();
        Instant now = jdbc.queryForObject("SELECT NOW()", java.sql.Timestamp.class).toInstant();
        assertTrue(delay.isAfter(now)); assertTrue(delay.isBefore(now.plusSeconds(20)));
    }

    @Test
    void manualRequestsExpediteDebouncedJobsWithoutAddingDuplicateGenerations() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        assertTrue(jobs.complete(jobs.claimNext().orElseThrow()));
        jobs.requestSync(itemId, false); assertTrue(jobs.claimNext().isEmpty());
        assertEquals("QUEUED", jobs.requestSync(itemId, true).status());
        assertEquals(2, version(itemId));
        var claim = jobs.claimNext().orElseThrow(); assertEquals(1, claim.attemptCount());
        assertTrue(jobs.complete(claim)); assertTrue(jobs.claimNext().isEmpty());
    }

    @Test
    void notificationsAfterFailureAreQueuedThroughCooldownInsteadOfDiscarded() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        assertTrue(jobs.fail(jobs.claimNext().orElseThrow(), "PERMANENT"));
        Instant failedAt = jdbc.queryForObject("SELECT completed_at FROM plaid_sync_jobs WHERE item_id=?",
                java.sql.Timestamp.class, itemId).toInstant();
        var pending = jobs.requestSync(itemId, false);
        assertEquals("QUEUED", pending.status()); assertEquals(0, pending.attemptCount());
        assertEquals(failedAt.plusSeconds(300), pending.nextAttemptAt());
        assertTrue(jobs.claimNext().isEmpty());
        assertEquals(pending.nextAttemptAt(), jobs.requestSync(itemId, false).nextAttemptAt());
        assertEquals(2, version(itemId)); makeReady(itemId);
        var claim = jobs.claimNext().orElseThrow(); assertEquals(1, claim.attemptCount());
        assertTrue(jobs.complete(claim));
    }

    @Test
    void aWebhookAcceptedDuringTheLastFailedAttemptRetainsItsPendingGeneration() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        for (int attempt = 1; attempt <= 8; attempt++) {
            makeReady(itemId); var claim = jobs.claimNext().orElseThrow();
            assertEquals(attempt, claim.attemptCount());
            if (attempt == 8) jobs.requestSync(itemId, false);
            assertTrue(jobs.retry(claim, "TEMPORARY"));
        }
        assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());
        assertEquals(0, jobs.statusForItem(itemId).orElseThrow().attemptCount());
        assertTrue(jobs.claimNext().isEmpty()); makeReady(itemId);
        var next = jobs.claimNext().orElseThrow(); assertEquals(2, next.claimedVersion());
        assertEquals(1, next.attemptCount()); assertTrue(jobs.complete(next));
    }

    @Test
    void pendingWorkSurvivesAPermanentFailureOfTheCurrentGeneration() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        var claim = jobs.claimNext().orElseThrow(); jobs.requestSync(itemId, false);
        assertTrue(jobs.fail(claim, "PERMANENT"));
        assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());
        assertTrue(jobs.claimNext().isEmpty()); makeReady(itemId);
        var next = jobs.claimNext().orElseThrow(); assertEquals(2, next.claimedVersion());
        assertEquals(1, next.attemptCount()); assertTrue(jobs.complete(next));
    }

    @Test
    void legacyQueuedRowsAtOrAboveTheAttemptLimitAreClaimableWithAFreshBudget() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        jdbc.update("UPDATE plaid_sync_jobs SET attempt_count=12 WHERE item_id=?", itemId);
        var claim = jobs.claimNext().orElseThrow(); assertEquals(1, claim.attemptCount());
        assertTrue(jobs.complete(claim)); assertEquals(0, jobs.statusForItem(itemId).orElseThrow().attemptCount());
    }

    @Test
    void exhaustedLeaseRecoveryKeepsPendingWorkAndFencesItsOldOwner() {
        String itemId = createItem(); jobs.requestSync(itemId, false);
        var stale = jobs.claimNext().orElseThrow(); jobs.requestSync(itemId, false);
        jdbc.update("UPDATE plaid_sync_jobs SET attempt_count=8, lease_expires_at=NOW()-INTERVAL '1 second' WHERE item_id=?", itemId);
        assertTrue(jobs.claimNext().isEmpty());
        assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());
        assertFalse(jobs.complete(stale)); assertFalse(jobs.retry(stale, "STALE")); assertFalse(jobs.fail(stale, "STALE"));
        makeReady(itemId); var recovered = jobs.claimNext().orElseThrow();
        assertEquals(1, recovered.attemptCount()); assertTrue(jobs.complete(recovered));
    }

    @Test
    void exhaustedLeaseWithoutPendingWorkBecomesTerminalInsteadOfRemainingProcessing() {
        String itemId = createItem(); jobs.requestSync(itemId, false); jobs.claimNext().orElseThrow();
        jdbc.update("UPDATE plaid_sync_jobs SET attempt_count=8, lease_expires_at=NOW()-INTERVAL '1 second' WHERE item_id=?", itemId);
        assertTrue(jobs.claimNext().isEmpty()); assertEquals("FAILED", jobs.statusForItem(itemId).orElseThrow().status());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentPostSuccessWebhooksCoalesceIntoOneClaimAcrossIndependentQueueInstances() throws Exception {
        String itemId = createItem(); jobs.requestSync(itemId, false); assertTrue(jobs.complete(jobs.claimNext().orElseThrow()));
        var pool = Executors.newFixedThreadPool(8); var start = new CountDownLatch(1);
        try {
            List<Future<PlaidSyncJobService.JobStatus>> notifications = new ArrayList<>();
            for (int i = 0; i < 8; i++) notifications.add(pool.submit(() -> { start.await(); return jobs.requestSync(itemId, false); }));
            start.countDown(); Instant deadline = null;
            for (var notification : notifications) {
                var status = notification.get(10, TimeUnit.SECONDS);
                assertEquals("QUEUED", status.status());
                if (deadline == null) deadline = status.nextAttemptAt();
                assertEquals(deadline, status.nextAttemptAt());
            }
            assertEquals(2, version(itemId)); assertTrue(jobs.claimNext().isEmpty()); makeReady(itemId);
            var firstInstance = new PlaidSyncJobService(jdbc, items);
            var secondInstance = new PlaidSyncJobService(jdbc, items);
            var transaction = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
            var claimStart = new CountDownLatch(1);
            var first = pool.submit(() -> { claimStart.await(); return transaction.execute(s -> firstInstance.claimNext()); });
            var second = pool.submit(() -> { claimStart.await(); return transaction.execute(s -> secondInstance.claimNext()); });
            claimStart.countDown();
            var claims = java.util.stream.Stream.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))
                    .flatMap(java.util.Optional::stream).toList();
            assertEquals(1, claims.size()); assertEquals(2, claims.get(0).claimedVersion());
            assertTrue(jobs.complete(claims.get(0))); assertTrue(jobs.claimNext().isEmpty());
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS)); cleanupItem(itemId); }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void aCompletionRacingWithANotificationCannotLoseTheFollowUp() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            for (int i = 0; i < 10; i++) {
                String itemId = createItem();
                try {
                    jobs.requestSync(itemId, false); var current = jobs.claimNext().orElseThrow();
                    var start = new CountDownLatch(1);
                    var completed = pool.submit(() -> { start.await(); return jobs.complete(current); });
                    var notified = pool.submit(() -> { start.await(); return jobs.requestSync(itemId, false); });
                    start.countDown(); assertTrue(completed.get(10, TimeUnit.SECONDS)); notified.get(10, TimeUnit.SECONDS);
                    assertEquals(2, version(itemId)); assertEquals("QUEUED", jobs.statusForItem(itemId).orElseThrow().status());
                    assertEquals(0, jobs.statusForItem(itemId).orElseThrow().attemptCount());
                    assertTrue(jobs.claimNext().isEmpty()); makeReady(itemId);
                    assertTrue(jobs.complete(jobs.claimNext().orElseThrow())); assertTrue(jobs.claimNext().isEmpty());
                } finally { cleanupItem(itemId); }
            }
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS)); }
    }

    private void makeReady(String itemId) {
        jdbc.update("UPDATE plaid_sync_jobs SET next_attempt_at=NOW() WHERE item_id=?", itemId);
    }

    private void cleanupItem(String itemId) {
        items.findByItemId(itemId).ifPresent(item -> {
            String userId = item.getUser().getId(); items.delete(item); userRepository.deleteById(userId);
        });
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
