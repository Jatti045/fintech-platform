package com.fintechapp.fintech_api.service;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.fintechapp.fintech_api.config.CacheConfig;

class FinancialCacheCommitBoundaryTest {
    @Test void allMutationEvictionsWaitUntilCommit() {
        CacheManager manager = mock(CacheManager.class);
        Cache summary = mock(Cache.class);
        Cache recurring = mock(Cache.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        Cursor<String> cursor = mock(Cursor.class);
        when(manager.getCache(CacheConfig.FINANCIAL_SUMMARY_CACHE)).thenReturn(summary);
        when(manager.getCache(CacheConfig.RECURRING_PAYMENTS_CACHE)).thenReturn(recurring);
        when(redis.scan(any())).thenReturn(cursor);
        FinancialCacheInvalidator invalidator = new FinancialCacheInvalidator(manager, redis);
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialSummaryForDate("user", java.time.Instant.parse("2027-01-01T00:30:00Z"));
            invalidator.evictRecurringPayments("user");
            invalidator.evictFinancialSummaryRegion("user");
            verifyNoInteractions(manager, redis, summary, recurring);
            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
            verify(summary).evict("user:2027:0");
            verify(recurring).evict("user");
            verify(redis).scan(any());
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }

    @Test void rollbackKeepsPreviouslyCommittedCache() {
        CacheManager manager = mock(CacheManager.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        FinancialCacheInvalidator invalidator = new FinancialCacheInvalidator(manager, redis);
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialSummary("user", 2026, 8);
            invalidator.evictRecurringPayments("user");
            invalidator.evictFinancialSummaryRegion("user");
            TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
            verifyNoInteractions(manager, redis);
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
}
