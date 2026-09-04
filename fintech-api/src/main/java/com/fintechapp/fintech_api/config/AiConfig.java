package com.fintechapp.fintech_api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * AI provider connectivity settings and an opinionated {@link RestClient} for
 * calling the provider's HTTP API.
 *
 * <p>The provider is selected purely through configuration — the business
 * layer depends on the {@code AiCompletionClient} abstraction, never on a
 * specific vendor. The initial implementation speaks the OpenAI-compatible
 * chat-completions API (which OpenAI, Groq, Ollama and most gateways expose);
 * another provider only needs a new {@code AiCompletionClient} implementation
 * selected through {@code app.ai.provider}.</p>
 *
 * <p>The API key stays server-side. It is never returned to any client and is
 * never logged.</p>
 */
@Configuration
public class AiConfig {

    /** Settings resolved from {@code app.ai.*} properties. */
    public record AiSettings(
            String provider,
            String apiKey,
            String model,
            String baseUrl,
            int timeoutSeconds) {

        /** True when enough configuration exists to call a provider. */
        public boolean isConfigured() {
            return StringUtils.hasText(apiKey) && StringUtils.hasText(model) && StringUtils.hasText(baseUrl);
        }
    }

    @Bean
    public AiSettings aiSettings(
            @Value("${app.ai.provider:}") String provider,
            @Value("${app.ai.api-key:}") String apiKey,
            @Value("${app.ai.model:}") String model,
            @Value("${app.ai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${app.ai.timeout-seconds:30}") int timeoutSeconds) {
        return new AiSettings(
                provider,
                apiKey,
                model,
                baseUrl,
                timeoutSeconds > 0 ? timeoutSeconds : 30);
    }

    @Bean("aiRestClient")
    public RestClient aiRestClient(AiSettings settings) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(settings.timeoutSeconds() * 1000);
        return RestClient.builder()
                .baseUrl(settings.baseUrl())
                .requestFactory(factory)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}
