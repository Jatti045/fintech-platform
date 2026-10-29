package com.fintechapp.fintech_api.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import com.fintechapp.fintech_api.dto.auth.ResetPasswordRequest;
import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.model.AuthProvider;
import com.fintechapp.fintech_api.model.PasswordResetToken;
import com.fintechapp.fintech_api.repository.PasswordResetTokenRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/** Challenge state is serialized on the account row, including first issuance. */
@Service
public class PasswordRecoveryService {
    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final int RESEND_COOLDOWN_SECONDS = 60;
    public static final ApiMessageResponse REQUEST_RESPONSE = new ApiMessageResponse(true,
            "If an eligible account exists, a reset code will be sent to its email.");
    private static final Logger logger = LoggerFactory.getLogger(PasswordRecoveryService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final EmailService email;
    private final TaskExecutor emailExecutor;
    private final String dummyHash;

    public PasswordRecoveryService(UserRepository users, PasswordResetTokenRepository tokens,
            PasswordEncoder encoder, EmailService email,
            @Qualifier("recoveryEmailExecutor") TaskExecutor emailExecutor) {
        this.users = users; this.tokens = tokens; this.encoder = encoder;
        this.email = email; this.emailExecutor = emailExecutor;
        this.dummyHash = encoder.encode("unavailable-recovery-challenge");
    }

    @Transactional
    public void issueCode(String normalizedEmail) {
        // Equal hashing work for eligible, absent, and provider-only accounts.
        String otp = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        String hash = encoder.encode(otp);
        var user = users.findByEmailForUpdate(normalizedEmail).orElse(null);
        if (user == null || user.getAuthProvider() != AuthProvider.EMAIL) return;
        var previous = tokens.findFirstByUser_IdOrderByCreatedAtDesc(user.getId()).orElse(null);
        if (previous != null && previous.getCreatedAt().plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(Instant.now())) return;
        tokens.deleteByUser_Id(user.getId());
        tokens.flush();
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user); token.setToken(hash); token.setExpiresAt(Instant.now().plusSeconds(900));
        tokens.save(token);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    emailExecutor.execute(() -> email.sendEmail(normalizedEmail, "Password reset code",
                            "Your password reset code is: " + otp + ". It expires in 15 minutes."));
                } catch (TaskRejectedException exception) {
                    // Never disclose account eligibility through queue pressure.
                    logger.warn("Recovery email queue is full");
                }
            }
        });
    }

    // Client errors MUST commit attempt increments; unexpected failures roll back.
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public ApiMessageResponse verify(String normalizedEmail, ResetPasswordRequest request) {
        var user = users.findByEmailForUpdate(normalizedEmail).orElse(null);
        var token = user == null || user.getAuthProvider() != AuthProvider.EMAIL ? null
                : tokens.findFirstByUser_IdOrderByCreatedAtDesc(user.getId()).orElse(null);
        boolean usable = token != null && token.getExpiresAt().isAfter(Instant.now())
                && token.getFailedAttempts() < MAX_FAILED_ATTEMPTS;
        boolean matches = encoder.matches(request.otp(), usable ? token.getToken() : dummyHash);
        if (!usable) throw invalidCode();
        if (!matches) {
            token.setFailedAttempts(token.getFailedAttempts() + 1);
            if (token.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) token.setExpiresAt(Instant.now());
            tokens.save(token);
            throw invalidCode();
        }
        if (request.isVerifyOnly()) return new ApiMessageResponse(true, "Code verified.");
        if (!StringUtils.hasText(request.newPassword()) || !StringUtils.hasText(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New passwords are required.");
        }
        if (request.newPassword().length() < 6 || request.newPassword().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters and at most 72 UTF-8 bytes.");
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
        }
        user.setPassword(encoder.encode(request.newPassword()));
        users.save(user);
        tokens.deleteByUser_Id(user.getId());
        return new ApiMessageResponse(true, "Password reset successful.");
    }

    public static ResponseStatusException invalidCode() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Invalid or expired reset code. Please request a new code.");
    }
}
