package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * Converts monetary amounts into the currency in which the application stores
 * aggregates. Rates intentionally follow the application's existing
 * current-rate model (rather than claiming historical-rate accuracy).
 */
@Service
public class CurrencyConversionService {

    private record CachedRate(double value, Instant expiresAt) { }

    private final RestClient restClient;
    private final Map<String, CachedRate> rates = new ConcurrentHashMap<>();
    private final Duration ttl;

    public CurrencyConversionService(
            @Qualifier("currencyRatesRestClient") RestClient restClient,
            @Value("${app.currency.rates-cache-seconds:3600}") long cacheSeconds) {
        this.restClient = restClient;
        this.ttl = Duration.ofSeconds(Math.max(1, cacheSeconds));
    }

    public double convert(double amount, String fromCurrency, String toCurrency) {
        String from = requireCurrency(fromCurrency);
        String to = requireCurrency(toCurrency);
        if (from.equals(to)) {
            return amount;
        }

        String key = from + ":" + to;
        CachedRate cached = rates.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return round2(amount * cached.value());
        }

        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new RateRequired(from, to);
        }
        return round2(amount * fetchRate(from, to));
    }

    // A cache miss inside a write aborts the transaction before fetching externally.
    // The next attempt rereads and revalidates all inputs under the writer lock.
    static <T> T withPreparedRates(CurrencyConversionService rates, java.util.function.Supplier<T> write) {
        for (int attempt = 0; ; attempt++) {
            try {
                return write.get();
            } catch (RateRequired missing) {
                if (attempt >= 8 || org.springframework.transaction.support.TransactionSynchronizationManager
                        .isActualTransactionActive()) {
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                            "Currency rates could not be prepared. Please retry.");
                }
                rates.convert(0, missing.from, missing.to);
            }
        }
    }

    private static final class RateRequired extends RuntimeException {
        private final String from;
        private final String to;
        private RateRequired(String from, String to) {
            this.from = from;
            this.to = to;
        }
    }

    private double fetchRate(String from, String to) {
        String key = from + ":" + to;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get()
                    .uri("/v4/latest/{currency}", from)
                    .retrieve()
                    .body(Map.class);
            Object rawRates = response == null ? null : response.get("rates");
            if (!(rawRates instanceof Map<?, ?> rateMap) || !(rateMap.get(to) instanceof Number rate)) {
                throw new IllegalStateException("target currency missing from rate response");
            }
            double value = rate.doubleValue();
            if (!Double.isFinite(value) || value <= 0) {
                throw new IllegalStateException("invalid exchange rate");
            }
            rates.put(key, new CachedRate(value, Instant.now().plus(ttl)));
            return value;
        } catch (Exception ex) {
            // Do not persist a raw amount under a different currency label. A
            // retryable failure is safer than silently corrupting aggregates.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Currency conversion is temporarily unavailable. Please retry.");
        }
    }

    private String requireCurrency(String value) {
        if (!StringUtils.hasText(value) || !value.trim().matches("(?i)[a-z]{3}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency code");
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
