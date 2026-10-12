package com.fintechapp.fintech_api.ai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fintechapp.fintech_api.config.AiConfig.AiSettings;

class AiLoggingSafetyTest {
    @Test
    void providerFailureNeverLogsPromptResponseOrCredential() {
        RestClient http = mock(RestClient.class);
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(http.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(request);
        when(request.header(eq("Authorization"), anyString())).thenReturn(request);
        when(request.body(any(Object.class))).thenReturn(request);
        when(request.retrieve()).thenReturn(response);
        when(response.body(OpenAiCompatibleAiClient.CompletionResponse.class))
                .thenThrow(new IllegalStateException("PRIVATE_PROVIDER_RESPONSE"));
        var client = new OpenAiCompatibleAiClient(http,
                new AiSettings("test", "PRIVATE_API_KEY", "test-model", "https://example.com", 30));
        Logger logger = (Logger) LoggerFactory.getLogger(OpenAiCompatibleAiClient.class);
        ListAppender<ILoggingEvent> output = new ListAppender<>();
        output.start(); logger.addAppender(output);
        try {
            assertThrows(AiClientException.class, () -> client.complete("PRIVATE_PROMPT", "PRIVATE_FINANCIAL_CONTEXT"));
            assertFalse(output.list.isEmpty());
            for (var event : output.list) {
                assertFalse(event.getFormattedMessage().contains("PRIVATE_"));
                assertNull(event.getThrowableProxy());
            }
        } finally { logger.detachAppender(output); output.stop(); }
    }
}
