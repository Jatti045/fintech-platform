package com.fintechapp.fintech_api.service;

import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Remote cleanup only. Never expose tokens or provider error messages in logs/exceptions. */
@Service
public class PlaidRevocationClient {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> SAFE_CODES = Set.of("INVALID_API_KEYS", "INVALID_CLIENT_ID",
            "INVALID_ACCESS_TOKEN", "UNAUTHORIZED_ENVIRONMENT", "UNAUTHORIZED_ROUTE_ACCESS",
            "ITEM_LOGIN_REQUIRED", "RATE_LIMIT_EXCEEDED", "INTERNAL_SERVER_ERROR", "INSTITUTION_DOWN");
    private final RestClient client;
    private final PlaidSettings settings;
    private final EncryptionService encryption;

    public static class Failure extends RuntimeException {
        public Failure(String code) { super(code); }
    }

    public PlaidRevocationClient(@Qualifier("plaidRestClient") RestClient client,
            PlaidSettings settings, EncryptionService encryption) {
        this.client = client;
        this.settings = settings;
        this.encryption = encryption;
    }

    public void revoke(String encryptedToken) {
        String token;
        try {
            token = encryption.decrypt(encryptedToken);
            if (!StringUtils.hasText(token)) throw new IllegalStateException();
        } catch (RuntimeException ex) {
            throw new Failure("CREDENTIAL_DECRYPT_FAILED");
        }
        try {
            JsonNode response = client.post().uri("/item/remove").contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("client_id", settings.clientId(), "secret", settings.secret(), "access_token", token))
                    .retrieve().body(JsonNode.class);
            if (response == null || !StringUtils.hasText(response.path("request_id").asString(null))
                    || response.has("error_code")) {
                throw new Failure("INVALID_PROVIDER_RESPONSE");
            }
        } catch (RestClientResponseException ex) {
            String code = "HTTP_" + ex.getStatusCode().value();
            try {
                JsonNode error = MAPPER.readTree(ex.getResponseBodyAsString());
                String providerCode = error.path("error_code").asString("");
                // Plaid documents this as a removed/depermissioned or nonexistent Item.
                // INVALID_ACCESS_TOKEN is ambiguous (e.g. wrong environment), so keep retrying it.
                if (ex.getStatusCode().value() == 400 && "ITEM_NOT_FOUND".equals(providerCode)
                        && "ITEM_ERROR".equals(error.path("error_type").asString(""))) return;
                if (SAFE_CODES.contains(providerCode)) code = providerCode;
            } catch (RuntimeException ignored) {
                // Malformed error bodies are failures, never evidence of revocation.
            }
            throw new Failure(code);
        } catch (RestClientException ex) {
            throw new Failure("PROVIDER_UNAVAILABLE");
        }
    }
}
