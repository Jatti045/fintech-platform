package com.fintechapp.fintech_api.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * AES-GCM encryption for sensitive fields stored at rest.
 *
 * <p>The persistence standard used across the API is bcrypt for one-way
 * hashing ({@code PasswordEncoder}). Plaid access tokens must be encrypted
 * (not hashed) because the sync flow needs the original value back, so this
 * service provides symmetric authenticated encryption with AES-256-GCM.
 * The AES key is derived from a dedicated {@code app.plaid.access-token-secret}
 * (falling back to the JWT secret when unset) and a random 12-byte IV is
 * prepended to each ciphertext, so the same value yields distinct ciphertexts.</p>
 */
@Service
public class EncryptionService {

    private static final Logger logger = LoggerFactory.getLogger(EncryptionService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;
    private static final String DEV_FALLBACK_KEY =
            "dev-only-plaid-access-token-key-change-in-production";

    private final SecretKeySpec key;

    public EncryptionService(
            @Value("${app.plaid.access-token-secret:}") String accessTokenSecret,
            @Value("${app.jwt.secret-key:}") String jwtSecret) {
        String resolved = StringUtils.hasText(accessTokenSecret) ? accessTokenSecret : jwtSecret;
        if (!StringUtils.hasText(resolved)) {
            logger.warn(
                    "Neither app.plaid.access-token-secret nor app.jwt.secret-key is set; "
                            + "falling back to a non-production encryption key");
            resolved = DEV_FALLBACK_KEY;
        }
        this.key = new SecretKeySpec(sha256(resolved), "AES");
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

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
