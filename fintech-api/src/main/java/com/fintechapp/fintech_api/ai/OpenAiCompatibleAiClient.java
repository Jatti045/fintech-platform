package com.fintechapp.fintech_api.ai;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import com.fintechapp.fintech_api.config.AiConfig.AiSettings;

/**
 * OpenAI-compatible chat-completions implementation of
 * {@link AiCompletionClient}. Chosen because it is the de-facto standard API
 * surface — OpenAI, Groq, Ollama, OpenRouter and most gateways all expose it —
 * so switching providers is usually just an {@code AI_BASE_URL} / model change.
 * A truly different vendor only needs another {@link AiCompletionClient} impl.
 *
 * <p>Never logs prompts, responses, or the API key.</p>
 */
@Component
public class OpenAiCompatibleAiClient implements AiCompletionClient {

    private static final Logger logger = LoggerFactory.getLogger(OpenAiCompatibleAiClient.class);

    private final RestClient restClient;
    private final AiSettings settings;

    public OpenAiCompatibleAiClient(
            @Qualifier("aiRestClient") RestClient aiRestClient,
            AiSettings settings) {
        this.restClient = aiRestClient;
        this.settings = settings;
    }

    @Override
    public String complete(String systemPrompt, String userContent) {
        if (!settings.isConfigured()) {
            throw new AiClientException(AiClientException.Kind.NOT_CONFIGURED, "AI provider is not configured");
        }

        Map<String, Object> body = Map.of(
                "model", settings.model(),
                "temperature", 0.4,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userContent)));

        CompletionResponse response;
        try {
            response = restClient.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + settings.apiKey())
                    .body(body)
                    .retrieve()
                    .body(CompletionResponse.class);
        } catch (Exception e) {
            logger.error("AI completion request failed: {}", e.getClass().getSimpleName());
            throw new AiClientException(AiClientException.Kind.PROVIDER_FAILURE, "AI provider request failed", e);
        }

        String content = response == null || response.choices() == null || response.choices().isEmpty()
                ? null
                : response.choices().get(0).message().content();
        if (!StringUtils.hasText(content)) {
            throw new AiClientException(AiClientException.Kind.PROVIDER_FAILURE, "AI provider returned an empty completion");
        }
        return content;
    }

    /** Minimal DTOs for the OpenAI-compatible chat completion shape. */
    record CompletionResponse(List<Choice> choices) {
        record Choice(Message message) {
        }

        record Message(String content) {
        }
    }
}
