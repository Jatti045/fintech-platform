package com.fintechapp.fintech_api.service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * AES-GCM encryption for sensitive fields stored at rest.
 *
 * The AES-256 key is derived from {@code app.plaid.access-token-secret}
 * using HKDF-SHA256. A random 12-byte IV is prepended to each ciphertext,
 * so the same plaintext yields distinct ciphertexts on every call.
 */
@Service
public class EncryptionService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;
    private static final int AES_KEY_LENGTH_BYTES = 32; // 256 bits

    private final SecretKeySpec key;

    public EncryptionService(
            @Value("${app.plaid.access-token-secret:}") String accessTokenSecret) {
        if (!StringUtils.hasText(accessTokenSecret)) {
            throw new IllegalStateException("app.plaid.access-token-secret must be set");
        }
        this.key = new SecretKeySpec(hkdf(accessTokenSecret), "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[IV_LENGTH_BYTES + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encrypt sensitive data", ex);
        }
    }

    public String decrypt(String ciphertext) {
        if (ciphertext == null) {
            return null;
        }
        try {
            byte[] payload = Base64.getDecoder().decode(ciphertext);
            byte[] iv = new byte[IV_LENGTH_BYTES];
            System.arraycopy(payload, 0, iv, 0, iv.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] decrypted = cipher.doFinal(payload, IV_LENGTH_BYTES, payload.length - IV_LENGTH_BYTES);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to decrypt sensitive data", ex);
        }
    }

    /**
     * HKDF-SHA256 extract+expand to derive a 256-bit AES key from the secret.
     * Uses a fixed info string to domain-separate this key from any other
     * derived keys in the future.
     */
    private static byte[] hkdf(String secret) {
        try {
            byte[] ikm = secret.getBytes(StandardCharsets.UTF_8);
            byte[] salt = "budgee-encryption-salt".getBytes(StandardCharsets.UTF_8);
            byte[] info = "budgee-plaid-access-token".getBytes(StandardCharsets.UTF_8);

            // Extract
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            byte[] prk = mac.doFinal(ikm);

            // Expand
            mac.init(new SecretKeySpec(prk, "HmacSHA256"));
            mac.update(info);
            mac.update((byte) 0x01); // counter
            byte[] okm = mac.doFinal();

            // Truncate to 32 bytes (256 bits)
            byte[] result = new byte[AES_KEY_LENGTH_BYTES];
            System.arraycopy(okm, 0, result, 0, AES_KEY_LENGTH_BYTES);
            return result;
        } catch (Exception ex) {
            throw new IllegalStateException("HKDF key derivation failed", ex);
        }
    }
}