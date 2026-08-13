package com.fintechapp.fintech_api.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * Plaid API connectivity settings and an opinionated {@link RestClient} for
 * calling the Plaid HTTP API.
 *
 * <p>Feeds every Plaid integration point: link token creation, item token
 * exchange, and the "/transactions/sync" cursor loop. The credential material
 * (client id/secret) stays server-side; only the short-lived link token or
 * public token ever crosses the wire to the mobile clients.</p>
 */
@Configuration
public class PlaidConfig {

    /** Settings resolved from {@code app.plaid.*} properties. */
    public record PlaidSettings(
            String clientId,
            String secret,
            String baseUrl,
            String webhookUrl,
            List<String> countryCodes,
            String language) {
    }

    @Bean
    public PlaidSettings plaidSettings(
            @Value("${app.plaid.client-id:}") String clientId,
            @Value("${app.plaid.secret:}") String secret,
            @Value("${app.plaid.environment:sandbox}") String environment,
            @Value("${app.plaid.webhook-url:}") String webhookUrl,
            @Value("${app.plaid.country-codes:US}") String countryCodes,
            @Value("${app.plaid.language:en}") String language) {
        List<String> resolvedCountries = Arrays.stream(countryCodes.split(","))
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .toList();
        return new PlaidSettings(
                clientId,
                secret,
                resolveBaseUrl(environment),
                webhookUrl,
                resolvedCountries,
                StringUtils.hasText(language) ? language : "en");
    }

    @Bean("plaidRestClient")
    public RestClient plaidRestClient(PlaidSettings settings) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        return RestClient.builder()
                .baseUrl(settings.baseUrl())
                .requestFactory(factory)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    private static String resolveBaseUrl(String environment) {
        String env = StringUtils.hasText(environment) ? environment.trim().toLowerCase() : "sandbox";
        return switch (env) {
            case "production" -> "https://production.plaid.com";
            case "development" -> "https://development.plaid.com";
            case "sandbox" -> "https://sandbox.plaid.com";
            default -> "https://sandbox.plaid.com";
        };
    }
}
