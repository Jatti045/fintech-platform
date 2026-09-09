package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fintechapp.fintech_api.repository.PlaidItemRepository;

@ExtendWith(MockitoExtension.class)
class PlaidSyncLockServiceTest {

    @Mock
    private PlaidItemRepository plaidItemRepository;

    private PlaidSyncLockService lockService;

    @BeforeEach
    void setUp() {
        lockService = new PlaidSyncLockService(plaidItemRepository);
    }

    @Test
    void tryAcquire_blankItemId_returnsFalse() {
        assertFalse(lockService.tryAcquire("", "token-1", Duration.ofSeconds(60)));
        assertFalse(lockService.tryAcquire(null, "token-1", Duration.ofSeconds(60)));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_blankToken_returnsFalse() {
        assertFalse(lockService.tryAcquire("item-1", "", Duration.ofSeconds(60)));
        assertFalse(lockService.tryAcquire("item-1", null, Duration.ofSeconds(60)));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_nullDuration_returnsFalse() {
        assertFalse(lockService.tryAcquire("item-1", "token-1", null));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_repositoryReturnsOne_returnsTrue() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        boolean acquired = lockService.tryAcquire("item-1", "token-1", Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void tryAcquire_repositoryReturnsZero_returnsFalse() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        boolean acquired = lockService.tryAcquire("item-1", "token-1", Duration.ofSeconds(60));

        assertFalse(acquired);
    }

    /**
     * Regression test for the production failure.
     *
     * The original bug was that {@link PlaidTransactionSyncService} constructed
     * {@link PlaidSyncLockService} via {@code new} instead of Spring injection,
     * producing a raw POJO instead of a Spring proxy. The
     * {@code @Transactional(REQUIRES_NEW)} on {@code tryAcquire} was therefore
     * ignored, and Hibernate threw {@code TransactionRequiredException} when the
     * {@code @Modifying} JPQL update ran without an active transaction.
     *
     * <p>
     * This test verifies that {@code tryAcquire} calls through to the
     * repository without throwing {@code TransactionRequiredException}. In the
     * unit-test context the repository is a Mockito mock (no real DB), so no
     * {@code TransactionRequiredException} can arise from the mock itself; the
     * valuable signal here is that the call path does NOT blow up on its own,
     * and that the repository method is invoked exactly once with the right
     * arguments — proving the service is wired correctly and delegates rather
     * than failing before even reaching the repository.
     *
     * <p>
     * The complementary integration test
     * {@code PlaidSyncDistributedLockIntegrationTest} exercises the real
     * transaction boundary against a live PostgreSQL container and will fail
     * with {@code TransactionRequiredException} if the proxy is absent.
     */
    @Test
    void tryAcquire_doesNotThrowTransactionRequiredException_repositoryIsInvoked() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        // Must not throw TransactionRequiredException or any other exception.
        boolean acquired = lockService.tryAcquire("item-1", "token-1", Duration.ofSeconds(60));

        assertTrue(acquired);
        // Repository was reached — the service did not short-circuit before the
        // @Modifying query.
        verify(plaidItemRepository, times(1))
                .acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class));
    }

    @Test
    void acquireWithTimeout_immediateSuccess_returnsTrueWithoutSleeping() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofSeconds(5),
                Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository, times(1)).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void acquireWithTimeout_eventualSuccess_returnsTrue() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0)
                .thenReturn(1);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofMillis(800),
                Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository, times(2)).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void acquireWithTimeout_timeoutExpires_returnsFalse() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofMillis(300),
                Duration.ofSeconds(60));

        assertFalse(acquired);
        verify(plaidItemRepository, org.mockito.Mockito.atLeast(2))
                .acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class));
    }

    @Test
    void release_blankParams_returnsFalse() {
        assertFalse(lockService.release(null, "token-1"));
        assertFalse(lockService.release("item-1", ""));
        verify(plaidItemRepository, never()).releaseSyncLock(any(), any());
    }

    @Test
    void release_repositoryUpdatesRow_returnsTrue() {
        when(plaidItemRepository.releaseSyncLock("item-1", "token-1")).thenReturn(1);

        assertTrue(lockService.release("item-1", "token-1"));
        verify(plaidItemRepository).releaseSyncLock("item-1", "token-1");
    }

    @Test
    void release_repositoryUpdatesZero_returnsFalse() {
        when(plaidItemRepository.releaseSyncLock("item-1", "token-1")).thenReturn(0);

        assertFalse(lockService.release("item-1", "token-1"));
    }

    /**
     * Verifies that a caller using the wrong token cannot release another
     * caller's lock. The repository update returns 0 when the stored token
     * does not match, so {@code release} must return {@code false} and never
     * disturb the lock row.
     */
    @Test
    void release_wrongToken_doesNotReleaseOtherToken() {
        // Repository enforces token match — wrong token returns 0 updated rows.
        when(plaidItemRepository.releaseSyncLock("item-1", "wrong-token")).thenReturn(0);

        boolean released = lockService.release("item-1", "wrong-token");

        assertFalse(released, "Wrong token must not be able to release another owner's lock");
        verify(plaidItemRepository).releaseSyncLock("item-1", "wrong-token");
        // The correct owner's token is never touched.
        verify(plaidItemRepository, never()).releaseSyncLock(eq("item-1"), eq("correct-token"));
    }

    @Test
    void extend_blankParams_returnsFalse() {
        assertFalse(lockService.extend(null, "token-1", Duration.ofSeconds(60)));
        assertFalse(lockService.extend("item-1", null, Duration.ofSeconds(60)));
        assertFalse(lockService.extend("item-1", "token-1", null));
        verify(plaidItemRepository, never()).extendSyncLock(any(), any(), any());
    }

    @Test
    void extend_repositoryUpdatesRow_returnsTrue() {
        when(plaidItemRepository.extendSyncLock(eq("item-1"), eq("token-1"), any(Instant.class))).thenReturn(1);

        assertTrue(lockService.extend("item-1", "token-1", Duration.ofSeconds(60)));
        verify(plaidItemRepository).extendSyncLock(eq("item-1"), eq("token-1"), any(Instant.class));
    }
}
