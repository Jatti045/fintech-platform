package com.fintechapp.fintech_api.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import com.fintechapp.fintech_api.repository.UserRepository;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtServiceTest {
    private static final String SECRET = "test-secret-key-test-secret-key-1234567890";
    private final UserRepository users = mock(UserRepository.class);
    private JwtService service() {
        var service = new JwtService(users);
        ReflectionTestUtils.setField(service, "secretKey", SECRET);
        return service;
    }
    private void unauthorized(Runnable operation) {
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(TokenAuthenticationException.class, operation::run).getStatus());
    }
    @Test void throwsServerConfigurationErrorWhenSecretIsMissing() {
        var exception = assertThrows(TokenAuthenticationException.class, () -> new JwtService(users).authenticate("any-token"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, exception.getStatus());
        assertEquals("Server configuration error.", exception.getMessage());
    }
    @Test void issuedTokensIncludeAnExpiryAndRoundTripTheSessionVersion() {
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(7L));
        var service = service();
        String token = service.generateToken("user", "user@example.com", 7);
        assertTrue(new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8).contains("\"exp\":"));
        assertEquals(7, service.authenticate(token).sessionVersion());
    }
    @Test void checksPersistentVersionOnEveryRequestAndFreshInstancesRejectRevokedTokens() {
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(0L));
        var firstInstance = service(); var secondInstance = service();
        String old = firstInstance.generateToken("user", "user@example.com", 0);
        firstInstance.authenticate(old); secondInstance.authenticate(old);
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(1L));
        unauthorized(() -> firstInstance.authenticate(old));
        unauthorized(() -> secondInstance.authenticate(old));
        unauthorized(() -> service().authenticate(old));
        String fresh = firstInstance.generateToken("user", "user@example.com", 1);
        assertEquals(1, secondInstance.authenticate(fresh).sessionVersion());
    }
    @Test void versionlessLegacyTokensOnlyWorkAtVersionZero() throws Exception {
        String legacy = signed("{\"userId\":\"user\",\"email\":\"user@example.com\",\"iat\":" + Instant.now().getEpochSecond() + "}");
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(0L));
        assertEquals(0, service().authenticate(legacy).sessionVersion());
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(1L));
        unauthorized(() -> service().authenticate(legacy));
    }
    @Test void malformedVersionClaimsCannotFallBackToLegacyVersionZero() throws Exception {
        when(users.findSessionVersionById("user")).thenReturn(Optional.of(0L));
        for (String claim : new String[]{"null", "\"0\"", "0.5", "-1", "9223372036854775808", "{}"}) {
            String token = signed("{\"userId\":\"user\",\"email\":\"user@example.com\",\"iat\":"
                    + Instant.now().getEpochSecond() + ",\"sessionVersion\":" + claim + "}");
            unauthorized(() -> service().authenticate(token));
        }
    }
    @Test void deletedAccountsAreUnauthorized() {
        when(users.findSessionVersionById("user")).thenReturn(Optional.empty());
        String token = service().generateToken("user", "user@example.com", 0);
        unauthorized(() -> service().authenticate(token));
    }
    @Test void invalidSignatureIsRejectedBeforeAnyAccountLookup() {
        String token = service().generateToken("user", "user@example.com", 0);
        unauthorized(() -> service().authenticate(token.substring(0, token.lastIndexOf('.') + 1) + "AAAA"));
        verifyNoInteractions(users);
    }
    @Test void invalidJsonAndNonObjectClaimsAreUnauthorized() throws Exception {
        for (String payload : new String[]{"not-json", "null", "[]", "\"text\""}) {
            String token = signed(payload);
            unauthorized(() -> service().authenticate(token));
        }
    }
    static String signed(String payload) throws Exception {
        var encoder = Base64.getUrlEncoder().withoutPadding();
        String input = encoder.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8))
                + "." + encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return input + "." + encoder.encodeToString(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
    }
}
