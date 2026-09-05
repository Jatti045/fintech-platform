package com.fintechapp.fintech_api.config;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import tools.jackson.databind.jsontype.PolymorphicTypeValidator;

import com.fintechapp.fintech_api.service.FinancialCacheInvalidator;

/**
 * Server-side cache configuration (Redis).
 *
 * <p>Caches exactly two domain reads, both resolved at the service layer:
 * the month financial summary ({@code financialSummary}) and the detected
 * recurring payments ({@code recurringPayments}). PostgreSQL remains the
 * source of truth — a cache miss, a Redis outage, or a malformed entry always
 * falls through to the database.</p>
 *
 * <p>Failure behavior: {@link #errorHandler()} swallows and logs cache access
 * failures so Redis never becomes a hard dependency of financial reads or
 * mutations. Invalidation itself is performed by
 * {@link FinancialCacheInvalidator} after successful database mutations.</p>
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(CacheConfig.class);

    /** Month financial aggregates. Explicitly invalidated on financial mutations. */
    public static final String FINANCIAL_SUMMARY_CACHE = "financialSummary";

    /** Detected recurring payments (time-sensitive, therefore the shorter TTL). */
    public static final String RECURRING_PAYMENTS_CACHE = "recurringPayments";

    /**
     * JSON value serializer. Polymorphic typing is enabled so record values
     * round-trip with their {@code @class} type id (without it, a cached value
     * would deserialize as a generic map); the type validator restricts the
     * ids accepted on deserialization instead of allowing arbitrary classes.
     * A malformed cached value surfaces as a get error and is treated as a
     * miss by the error handler below.
     */
    private static GenericJacksonJsonRedisSerializer cacheValueSerializer() {
        PolymorphicTypeValidator typeValidator = BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType(Object.class)
                .build();
        return GenericJacksonJsonRedisSerializer.builder()
                .enableDefaultTyping(typeValidator)
                .enableSpringCacheNullValueSupport()
                .build();
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .computePrefixWith(name -> name + "::")
                .serializeValuesWith(SerializationPair.fromSerializer(cacheValueSerializer()));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(base)
                .withCacheConfiguration(FINANCIAL_SUMMARY_CACHE, base.entryTtl(Duration.ofMinutes(10)))
                .withCacheConfiguration(RECURRING_PAYMENTS_CACHE, base.entryTtl(Duration.ofMinutes(15)))
                .build();
    }

    /**
     * Treats Redis as a best-effort cache: any failure to read, write, or
     * evict is logged and ignored so requests proceed against PostgreSQL.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Redis cache get failed (serving from database): cache={} key={}",
                        cache.getName(), key, exception);
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                logger.warn("Redis cache put failed (data unaffected): cache={} key={}",
                        cache.getName(), key, exception);
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Redis cache evict failed (TTL bounds staleness): cache={} key={}",
                        cache.getName(), key, exception);
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                logger.warn("Redis cache clear failed (data unaffected): cache={}", cache.getName(), exception);
            }
        };
    }
}
