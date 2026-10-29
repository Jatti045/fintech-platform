package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import java.net.SocketTimeoutException;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;

class PlaidRevocationClientTest {
    private static final String TOKEN = "access-sandbox-sensitive-test-token";
    private final EncryptionService encryption = new EncryptionService("revocation-test-encryption-secret");
    private MockRestServiceServer server;
    private PlaidRevocationClient client;

    @BeforeEach
    void prepare() {
        var builder = RestClient.builder().baseUrl("https://sandbox.plaid.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new PlaidRevocationClient(builder.build(), new PlaidSettings(
                "client", "secret", "https://sandbox.plaid.com", "", List.of("US"), "en"), encryption);
    }

    @Test
    void successfulRemovalSendsDecryptedTokenOnlyToPlaid() {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andExpect(content().json("""
                        {"client_id":"client","secret":"secret","access_token":"access-sandbox-sensitive-test-token"}
                        """))
                .andRespond(withSuccess("{\"request_id\":\"confirmed\"}", MediaType.APPLICATION_JSON));
        client.revoke(encryption.encrypt(TOKEN));
        server.verify();
    }

    @Test
    void alreadyRemovedItemCountsAsConfirmation() {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON).body("""
                        {"error_type":"ITEM_ERROR","error_code":"ITEM_NOT_FOUND"}
                        """));
        assertDoesNotThrow(() -> client.revoke(encryption.encrypt(TOKEN)));
        server.verify();
    }

    @ParameterizedTest
    @CsvSource({
            "400, INVALID_ACCESS_TOKEN", "400, INVALID_API_KEYS", "400, ITEM_LOGIN_REQUIRED",
            "429, RATE_LIMIT_EXCEEDED", "500, INTERNAL_SERVER_ERROR"
    })
    void ambiguousOrTransientErrorsRemainFailures(int status, String code) {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andRespond(withStatus(HttpStatus.valueOf(status)).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error_type\":\"INVALID_INPUT\",\"error_code\":\"" + code
                                + "\",\"error_message\":\"" + TOKEN + "\"}"));
        var error = assertThrows(PlaidRevocationClient.Failure.class, () -> client.revoke(encryption.encrypt(TOKEN)));
        assertEquals(code, error.getMessage());
        assertNull(error.getCause(), "Provider bodies and access tokens must not escape through exception causes");
        server.verify();
    }

    @Test
    void malformedOrMisleadingErrorBodyCannotConfirmRevocation() {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY).body("ITEM_NOT_FOUND " + TOKEN));
        var error = assertThrows(PlaidRevocationClient.Failure.class, () -> client.revoke(encryption.encrypt(TOKEN)));
        assertEquals("HTTP_502", error.getMessage());
    }

    @Test
    void networkTimeoutRemainsRetryableWithoutLeakingRequestData() {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andRespond(request -> { throw new SocketTimeoutException(TOKEN); });
        var error = assertThrows(PlaidRevocationClient.Failure.class, () -> client.revoke(encryption.encrypt(TOKEN)));
        assertEquals("PROVIDER_UNAVAILABLE", error.getMessage());
        assertNull(error.getCause());
    }

    @Test
    void emptySuccessCannotConfirmRevocation() {
        server.expect(requestTo("https://sandbox.plaid.com/item/remove"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        var error = assertThrows(PlaidRevocationClient.Failure.class, () -> client.revoke(encryption.encrypt(TOKEN)));
        assertEquals("INVALID_PROVIDER_RESPONSE", error.getMessage());
    }

    @Test
    void decryptionFailureNeverCallsProviderOrIncludesCiphertext() {
        var error = assertThrows(PlaidRevocationClient.Failure.class, () -> client.revoke("corrupted-ciphertext"));
        assertEquals("CREDENTIAL_DECRYPT_FAILED", error.getMessage());
        assertNull(error.getCause());
        server.verify();
    }
}
