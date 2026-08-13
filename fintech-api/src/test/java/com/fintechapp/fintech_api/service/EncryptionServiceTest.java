package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class EncryptionServiceTest {

    private static final String ACCESS_SECRET = "access-token-secret-1234567890";
    private static final String JWT_SECRET = "jwt-secret-key-1234567890";
    private static final String OTHER_SECRET = "a-completely-different-secret-key";

    private EncryptionService service(String accessSecret, String jwtSecret) {
        return new EncryptionService(accessSecret, jwtSecret);
    }

    // ── Round trips across key configurations ────────────────────────────────

    @ParameterizedTest
    @MethodSource("keyConfigs")
    void encryptThenDecrypt_roundTripsPlaintext(String accessSecret, String jwtSecret, String plaintext) {
        EncryptionService svc = service(accessSecret, jwtSecret);
        String ciphertext = svc.encrypt(plaintext);
        assertEquals(plaintext, svc.decrypt(ciphertext));
    }

    static Stream<Arguments> keyConfigs() {
        return Stream.of(
                // access-token secret only
                Arguments.of(ACCESS_SECRET, "", "super-secret-access-token"),
                // jwt secret only (fallback)
                Arguments.of("", JWT_SECRET, "another-token-value"),
                // both set — access secret wins
                Arguments.of(ACCESS_SECRET, JWT_SECRET, "mixed-config-token"),
                // neither set — dev fallback key still works
                Arguments.of("", "", "dev-fallback-token"),
                // long, unicode + special characters
                Arguments.of(ACCESS_SECRET, JWT_SECRET, "héllo wörld 🚀 — tokens & $pecial \"quotes\""),
                // numeric / repeated chars
                Arguments.of(ACCESS_SECRET, JWT_SECRET, "111111111122222222223333333333"),
                // empty string
                Arguments.of(ACCESS_SECRET, JWT_SECRET, ""),
                // single character
                Arguments.of(ACCESS_SECRET, JWT_SECRET, "a"),
                // whitespace-heavy
                Arguments.of(ACCESS_SECRET, JWT_SECRET, "   spaced   out   ")
        );
    }

    // ── Key fallback semantics ───────────────────────────────────────────────

    @Test
    void encryptWithAccessSecret_decryptWithOnlyJwtSecret_fails() {
        EncryptionService encryptor = service(ACCESS_SECRET, "");
        EncryptionService decryptor = service("", JWT_SECRET);
        String ciphertext = encryptor.encrypt("token");
        assertThrows(IllegalStateException.class, () -> decryptor.decrypt(ciphertext));
    }

    @Test
    void encryptWithJwtSecretOnly_decryptWithJwtSecretOnly_succeeds() {
        EncryptionService svc = service("", JWT_SECRET);
        String ciphertext = svc.encrypt("jwt-based-token");
        assertEquals("jwt-based-token", svc.decrypt(ciphertext));
    }

    @Test
    void encryptWithDevFallback_whenBothSecretsEmpty_roundTrips() {
        EncryptionService svc = service("", "");
        String ciphertext = svc.encrypt("dev-token");
        assertEquals("dev-token", svc.decrypt(ciphertext));
    }

    // ── Null / empty handling ────────────────────────────────────────────────

    @Test
    void encrypt_null_returnsNull() {
        assertNull(service(ACCESS_SECRET, JWT_SECRET).encrypt(null));
    }

    @Test
    void decrypt_null_returnsNull() {
        assertNull(service(ACCESS_SECRET, JWT_SECRET).decrypt(null));
    }

    // ── Ciphertext properties ────────────────────────────────────────────────

    @Test
    void encrypt_samePlaintextTwice_producesDistinctCiphertexts() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        String c1 = svc.encrypt("same-value");
        String c2 = svc.encrypt("same-value");
        assertNotEquals(c1, c2);
        assertEquals("same-value", svc.decrypt(c1));
        assertEquals("same-value", svc.decrypt(c2));
    }

    @Test
    void encrypt_differentPlaintexts_produceDifferentCiphertexts() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        assertNotEquals(svc.encrypt("one"), svc.encrypt("two"));
    }

    @Test
    void encrypt_outputIsBase64() {
        String ciphertext = service(ACCESS_SECRET, JWT_SECRET).encrypt("token");
        assertTrue(ciphertext.matches("^[A-Za-z0-9+/=]+$"));
    }

    // ── Corruption / tampering ───────────────────────────────────────────────

    @Test
    void decrypt_notBase64_throws() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        assertThrows(IllegalStateException.class, () -> svc.decrypt("!!!not-base64!!!"));
    }

    @Test
    void decrypt_tamperedCiphertext_throws() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        String ciphertext = svc.encrypt("payload");
        String tampered = ciphertext.substring(0, ciphertext.length() - 2) + "AA";
        assertThrows(IllegalStateException.class, () -> svc.decrypt(tampered));
    }

    @Test
    void decrypt_truncatedCiphertext_throws() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        String ciphertext = svc.encrypt("payload-that-is-quite-long");
        assertThrows(IllegalStateException.class, () -> svc.decrypt(ciphertext.substring(0, 8)));
    }

    @Test
    void decrypt_ciphertextFromOtherKey_throws() {
        EncryptionService other = service(OTHER_SECRET, "");
        String ciphertext = other.encrypt("cross-key-token");
        assertThrows(IllegalStateException.class, () -> service(ACCESS_SECRET, "").decrypt(ciphertext));
    }

    @Test
    void decrypt_flippedBytes_throws() {
        EncryptionService svc = service(ACCESS_SECRET, JWT_SECRET);
        String ciphertext = svc.encrypt("flip-me");
        // Flip a character in the body to corrupt the GCM auth tag.
        String flipped = ciphertext.substring(0, 10) + (ciphertext.charAt(10) == 'A' ? 'B' : 'A')
                + ciphertext.substring(11);
        assertThrows(IllegalStateException.class, () -> svc.decrypt(flipped));
    }

    // ── Portability ──────────────────────────────────────────────────────────

    @Test
    void ciphertext_decryptableAcrossSeparateInstancesWithSameKey() {
        EncryptionService a = service(ACCESS_SECRET, JWT_SECRET);
        EncryptionService b = service(ACCESS_SECRET, JWT_SECRET);
        String ciphertext = a.encrypt("portable-token");
        assertEquals("portable-token", b.decrypt(ciphertext));
    }
}

