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
    private static final String OTHER_SECRET = "a-completely-different-secret-key";

    private EncryptionService service(String accessSecret) {
        return new EncryptionService(accessSecret);
    }

    // ── Round trips across plaintext values ──────────────────────────────────

    @ParameterizedTest
    @MethodSource("plaintexts")
    void encryptThenDecrypt_roundTripsPlaintext(String plaintext) {
        EncryptionService svc = service(ACCESS_SECRET);
        String ciphertext = svc.encrypt(plaintext);
        assertEquals(plaintext, svc.decrypt(ciphertext));
    }

    static Stream<Arguments> plaintexts() {
        return Stream.of(
                Arguments.of("super-secret-access-token"),
                Arguments.of("another-token-value"),
                Arguments.of("héllo wörld 🚀 — tokens & $pecial \"quotes\""),
                Arguments.of("111111111122222222223333333333"),
                Arguments.of(""),
                Arguments.of("a"),
                Arguments.of("   spaced   out   ")
        );
    }

    // ── Key handling semantics ───────────────────────────────────────────────

    @Test
    void constructor_blankSecret_throws() {
        assertThrows(IllegalStateException.class, () -> service(""));
        assertThrows(IllegalStateException.class, () -> service("   "));
        assertThrows(IllegalStateException.class, () -> service(null));
    }

    @Test
    void encryptWithOneKey_decryptWithDifferentKey_fails() {
        EncryptionService encryptor = service(ACCESS_SECRET);
        EncryptionService decryptor = service(OTHER_SECRET);
        String ciphertext = encryptor.encrypt("token");
        assertThrows(IllegalStateException.class, () -> decryptor.decrypt(ciphertext));
    }

    // ── Null / empty handling ────────────────────────────────────────────────

    @Test
    void encrypt_null_returnsNull() {
        assertNull(service(ACCESS_SECRET).encrypt(null));
    }

    @Test
    void decrypt_null_returnsNull() {
        assertNull(service(ACCESS_SECRET).decrypt(null));
    }

    // ── Ciphertext properties ────────────────────────────────────────────────

    @Test
    void encrypt_samePlaintextTwice_producesDistinctCiphertexts() {
        EncryptionService svc = service(ACCESS_SECRET);
        String c1 = svc.encrypt("same-value");
        String c2 = svc.encrypt("same-value");
        assertNotEquals(c1, c2);
        assertEquals("same-value", svc.decrypt(c1));
        assertEquals("same-value", svc.decrypt(c2));
    }

    @Test
    void encrypt_differentPlaintexts_produceDifferentCiphertexts() {
        EncryptionService svc = service(ACCESS_SECRET);
        assertNotEquals(svc.encrypt("one"), svc.encrypt("two"));
    }

    @Test
    void encrypt_outputIsBase64() {
        String ciphertext = service(ACCESS_SECRET).encrypt("token");
        assertTrue(ciphertext.matches("^[A-Za-z0-9+/=]+$"));
    }

    // ── Corruption / tampering ───────────────────────────────────────────────

    @Test
    void decrypt_notBase64_throws() {
        EncryptionService svc = service(ACCESS_SECRET);
        assertThrows(IllegalStateException.class, () -> svc.decrypt("!!!not-base64!!!"));
    }

    @Test
    void decrypt_tamperedCiphertext_throws() {
        EncryptionService svc = service(ACCESS_SECRET);
        String ciphertext = svc.encrypt("payload");
        String tampered = ciphertext.substring(0, ciphertext.length() - 2) + "AA";
        assertThrows(IllegalStateException.class, () -> svc.decrypt(tampered));
    }

    @Test
    void decrypt_truncatedCiphertext_throws() {
        EncryptionService svc = service(ACCESS_SECRET);
        String ciphertext = svc.encrypt("payload-that-is-quite-long");
        assertThrows(IllegalStateException.class, () -> svc.decrypt(ciphertext.substring(0, 8)));
    }

    @Test
    void decrypt_ciphertextFromOtherKey_throws() {
        EncryptionService other = service(OTHER_SECRET);
        String ciphertext = other.encrypt("cross-key-token");
        assertThrows(IllegalStateException.class, () -> service(ACCESS_SECRET).decrypt(ciphertext));
    }

    @Test
    void decrypt_flippedBytes_throws() {
        EncryptionService svc = service(ACCESS_SECRET);
        String ciphertext = svc.encrypt("flip-me");
        // Flip a character in the body to corrupt the GCM auth tag.
        String flipped = ciphertext.substring(0, 10) + (ciphertext.charAt(10) == 'A' ? 'B' : 'A')
                + ciphertext.substring(11);
        assertThrows(IllegalStateException.class, () -> svc.decrypt(flipped));
    }

    // ── Portability ──────────────────────────────────────────────────────────

    @Test
    void ciphertext_decryptableAcrossSeparateInstancesWithSameKey() {
        EncryptionService a = service(ACCESS_SECRET);
        EncryptionService b = service(ACCESS_SECRET);
        String ciphertext = a.encrypt("portable-token");
        assertEquals("portable-token", b.decrypt(ciphertext));
    }
}

