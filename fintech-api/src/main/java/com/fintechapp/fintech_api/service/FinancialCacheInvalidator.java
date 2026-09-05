package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.fintechapp.fintech_api.config.CacheConfig;

/**
 * Evicts the server-side Redis caches after successful financial mutations.
 *
 * <p>Invalidation is keyed exactly like the cached reads:</p>
 * <ul>
 *   <li>month financial summary — {@code financialSummary::{userId}:{year}:{month}}
 *       (zero-based month, the API convention);</li>
 *   <li>recurring payments — {@code recurringPayments::{userId}}.</li>
 * </ul>
 *
 * <p>Month-precise eviction is used when the affected month is known
 * (transaction create/update/delete). A user-wide region eviction (bounded
 * SCAN) is used when any month of that user may be affected — Plaid sync
 * pages, monthly-income baseline changes (they apply to the target month and
 * every later month), and account deletion. This is the only place Redis is
 * touched outside the Spring cache abstraction.</p>
 *
 * <p>Every method is failure-tolerant: if Redis is unavailable the eviction is
 * skipped with a warning and the entry simply expires via its TTL. A cache
 * failure must never break a financial mutation.</p>
 */
@Component
public class FinancialCacheInvalidator {

    private static final Logger logger = LoggerFactory.getLogger(FinancialCacheInvalidator.class);

    private final CacheManager cacheManager;
    private final StringRedisTemplate redisTemplate;

    public FinancialCacheInvalidator(CacheManager cacheManager, StringRedisTemplate redisTemplate) {
        this.cacheManager = cacheManager;
        this.redisTemplate = redisTemplate;
    }

    /** Evicts the cached month summary for one user after that month changes. */
    public void evictFinancialSummary(String userId, int year, int month) {
        evict(CacheConfig.FINANCIAL_SUMMARY_CACHE, summaryKey(userId, year, month));
    }

    /**
     * Evicts every cached month summary of one user. Used when the change
     * affects an unbounded set of months (income baseline changes, Plaid
     * sync pages spanning history, account deletion).
     */
    public void evictFinancialSummaryRegion(String userId) {
        String pattern = CacheConfig.FINANCIAL_SUMMARY_CACHE + "::" + userId + ":*";
        try {
            Set<String> keys = new LinkedHashSet<>();
            ScanOptions options = ScanOptions.scanOptions().match(pattern).count(100).build();
            try (Cursor<String> cursor = redisTemplate.scan(options)) {
                while (cursor.hasNext()) {
                    keys.add(cursor.next());
                }
            }
            if (!keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
        } catch (RuntimeException ex) {
            logger.warn("Redis summary region eviction failed for user (entries expire via TTL): {}",
                    userId, ex);
        }
    }

    /** Evicts the cached recurring-payment detection for one user. */
    public void evictRecurringPayments(String userId) {
        evict(CacheConfig.RECURRING_PAYMENTS_CACHE, userId);
    }

    private void evict(String cacheName, Object key) {
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.evict(key);
            }
        } catch (RuntimeException ex) {
            logger.warn("Redis cache eviction failed (entries expire via TTL): cache={} key={}",
                    cacheName, key, ex);
        }
    }

    /** Mirrors the {@code @Cacheable} key on {@code FinancialSummaryService}. */
    private String summaryKey(String userId, int year, int month) {
        return userId + ":" + year + ":" + month;
    }

    /** Zero-based month of an instant (UTC), the API's month convention. */
    static int monthIndexOf(LocalDate date) {
        return date.getMonthValue() - 1;
    }

    /** Convenience overload used by transaction mutations. */
    public void evictFinancialSummaryForDate(String userId, Instant date) {
        LocalDate localDate = LocalDate.ofInstant(date, ZoneOffset.UTC);
        evictFinancialSummary(userId, localDate.getYear(), monthIndexOf(localDate));
    }
}
