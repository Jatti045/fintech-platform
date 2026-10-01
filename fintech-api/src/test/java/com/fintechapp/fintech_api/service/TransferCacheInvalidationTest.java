package com.fintechapp.fintech_api.service;

import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class TransferCacheInvalidationTest {
    @Test void financialEvictionWaitsForSuccessfulCommit() {
        org.springframework.cache.CacheManager manager = mock(org.springframework.cache.CacheManager.class);
        org.springframework.cache.Cache cache = mock(org.springframework.cache.Cache.class);
        when(manager.getCache(anyString())).thenReturn(cache);
        org.springframework.data.redis.core.StringRedisTemplate redis = mock(org.springframework.data.redis.core.StringRedisTemplate.class);
        when(redis.scan(any())).thenReturn(mock(org.springframework.data.redis.core.Cursor.class));
        FinancialCacheInvalidator invalidator = new FinancialCacheInvalidator(manager, redis);
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialDataAfterCommit("user");
            verifyNoInteractions(manager, redis);
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            verify(redis).scan(any());
            verify(cache).evict("user");
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
    @Test void rollbackDoesNotPublishFinancialEviction() {
        org.springframework.cache.CacheManager manager = mock(org.springframework.cache.CacheManager.class);
        org.springframework.data.redis.core.StringRedisTemplate redis = mock(org.springframework.data.redis.core.StringRedisTemplate.class);
        FinancialCacheInvalidator invalidator = new FinancialCacheInvalidator(manager, redis);
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialDataAfterCommit("user");
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(1));
            verifyNoInteractions(manager, redis);
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
}
