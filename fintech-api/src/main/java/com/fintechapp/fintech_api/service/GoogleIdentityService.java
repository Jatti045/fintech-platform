package com.fintechapp.fintech_api.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Objects;
import com.fintechapp.fintech_api.dto.auth.*;
import com.fintechapp.fintech_api.dto.common.ApiMessageResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import com.fintechapp.fintech_api.security.GoogleIdentityVerifier;
import com.fintechapp.fintech_api.security.GoogleIdentityVerifier.Identity;
import com.fintechapp.fintech_api.security.JwtService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Google verification is outside database transactions; identity/session decisions commit together. */
@Service
public class GoogleIdentityService {
    private static final Logger logger = LoggerFactory.getLogger(GoogleIdentityService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;
    private static final ApiMessageResponse CODE_RESPONSE = new ApiMessageResponse(true,
            "If verification is needed, a sign-in code will be sent to your email.");
    private final GoogleIdentityVerifier verifier;
    private final UserRepository users;
    private final GoogleIdentityChallengeRepository challenges;
    private final PasswordRecoveryRateLimiter limits;
    private final PasswordEncoder encoder;
    private final EmailService email;
    private final TaskExecutor emailExecutor;
    private final JdbcTemplate jdbc;
    private final JwtService jwt;
    private final IncomeCalculationService income;
    private final TransactionTemplate transaction;

    public GoogleIdentityService(GoogleIdentityVerifier verifier, UserRepository users,
            GoogleIdentityChallengeRepository challenges, PasswordRecoveryRateLimiter limits,
            PasswordEncoder encoder, EmailService email, @Qualifier("recoveryEmailExecutor") TaskExecutor emailExecutor,
            JdbcTemplate jdbc, JwtService jwt, IncomeCalculationService income, PlatformTransactionManager manager) {
        this.verifier = verifier; this.users = users; this.challenges = challenges; this.limits = limits;
        this.encoder = encoder; this.email = email; this.emailExecutor = emailExecutor;
        this.jdbc = jdbc; this.jwt = jwt; this.income = income; this.transaction = new TransactionTemplate(manager);
    }

    public GoogleAuthResponse signIn(GoogleAuthRequest request, String source) {
        Identity identity = verifier.verify(request == null ? null : request.idToken());
        if (request != null && request.verificationCode() != null) limits.checkGoogleVerification(identity.email(), source);
        try {
            GoogleAuthResponse response = transaction.execute(status -> signInLocked(identity,
                    request == null ? null : request.verificationCode()));
            // A rejected code must COMMIT its failed-attempt counter before returning an error.
            if (response == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Google email verification required. Request a code and try again.");
            return response;
        } catch (DataIntegrityViolationException conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account identity changed. Please sign in again.");
        }
    }

    public ApiMessageResponse requestCode(GoogleAuthRequest request, String source) {
        Identity identity = verifier.verify(request == null ? null : request.idToken());
        if (!limits.allowGoogleRequest(identity.email(), source)) return CODE_RESPONSE;
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        String hash = encoder.encode(code);
        transaction.executeWithoutResult(status -> {
            lockEmail(identity.email());
            if (users.findByGoogleSubjectForUpdate(identity.subject()).isPresent()) return;
            User user = emailCandidate(identity.email());
            if (user != null && user.getGoogleSubject() != null) return;
            GoogleIdentityChallenge challenge = challenges.findById(identity.email()).orElse(null);
            if (challenge != null && challenge.getCreatedAt().plusSeconds(60).isAfter(Instant.now())) return;
            if (challenge == null) { challenge = new GoogleIdentityChallenge(); challenge.setEmail(identity.email()); }
            challenge.setGoogleSubject(identity.subject()); challenge.setTargetUser(user); challenge.setTokenHash(hash);
            challenge.setCreatedAt(Instant.now()); challenge.setExpiresAt(Instant.now().plusSeconds(600));
            challenge.setFailedAttempts(0); challenges.save(challenge);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    try {
                        emailExecutor.execute(() -> email.sendEmail(identity.email(), "Google sign-in verification code",
                                "Your Google sign-in code is: " + code + ". It expires in 10 minutes. "
                                + "Use it only to complete the Google sign-in you requested."));
                    } catch (RuntimeException rejected) {
                        logger.warn("Google verification email could not be queued");
                    }
                }
            });
        });
        return CODE_RESPONSE;
    }

    private GoogleAuthResponse signInLocked(Identity identity, String code) {
        User bound = users.findByGoogleSubjectForUpdate(identity.subject()).orElse(null);
        // Email is contact metadata, never the identity of a returning Google user.
        if (bound != null) return session(bound);
        lockEmail(identity.email());
        // Another registration may have committed while this request waited for the email lock.
        bound = users.findByGoogleSubjectForUpdate(identity.subject()).orElse(null);
        if (bound != null) return session(bound);
        User candidate = emailCandidate(identity.email());
        if (candidate != null && candidate.getGoogleSubject() != null) return null;
        if (candidate != null || !identity.authoritativeEmail()) {
            if (!consumeProof(identity, candidate, code)) return null;
        }
        User user = candidate;
        if (user == null) {
            user = new User(); user.setEmail(identity.email()); user.setUsername(identity.name());
            user.setAuthProvider(AuthProvider.GOOGLE); user.setGoogleSubject(identity.subject());
            users.saveAndFlush(user);
        } else {
            // Keep EMAIL provider/password recovery intact when adding Google to a password account.
            if (users.bindGoogleSubject(user.getId(), identity.subject()) != 1) throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Account identity changed. Please sign in again.");
            user = users.findByIdForUpdate(user.getId()).orElseThrow();
        }
        challenges.deleteById(identity.email());
        return session(user);
    }

    private boolean consumeProof(Identity identity, User target, String code) {
        GoogleIdentityChallenge proof = challenges.findById(identity.email()).orElse(null);
        if (proof == null || code == null || !code.matches("[0-9]{6}") || proof.getFailedAttempts() >= MAX_ATTEMPTS
                || !proof.getExpiresAt().isAfter(Instant.now())) return false;
        String targetId = target == null ? null : target.getId();
        String proofTargetId = proof.getTargetUser() == null ? null : proof.getTargetUser().getId();
        // Count every guess, including a code presented for a different subject/account.
        proof.setFailedAttempts(proof.getFailedAttempts() + 1);
        boolean valid = identity.subject().equals(proof.getGoogleSubject()) && Objects.equals(targetId, proofTargetId)
                && encoder.matches(code, proof.getTokenHash());
        challenges.save(proof);
        return valid;
    }

    private User emailCandidate(String email) {
        var matches = users.findAllByEmailForGoogleUpdate(email);
        if (matches.size() > 1) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This email matches multiple accounts. Contact support to verify account ownership.");
        return matches.isEmpty() ? null : matches.get(0);
    }

    private void lockEmail(String email) {
        // Also serializes first-time registration/challenges where no user row exists yet.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?, 29))", Object.class, email);
    }

    private GoogleAuthResponse session(User user) {
        LocalDate now = LocalDate.now(ZoneOffset.UTC);
        int year = now.getYear(), month = now.getMonthValue() - 1;
        String token = jwt.generateToken(user.getId(), user.getEmail(), user.getSessionVersion());
        var summary = new UserSummaryResponse(user.getId(), user.getUsername(), user.getEmail(), user.getProfilePic(),
                user.getCurrency(), income.resolveExpectedForMonth(user, year, month),
                income.resolveActualForMonth(user, year, month), user.getCreatedAt(), user.getUpdatedAt());
        return new GoogleAuthResponse(true, "Login successful.", new LoginData(summary, token));
    }
}
