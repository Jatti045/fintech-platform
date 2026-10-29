package com.fintechapp.fintech_api.integration.controller;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import java.util.function.IntFunction;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.service.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Real committed PostgreSQL transactions: an outer test rollback must not hide counters. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PasswordRecoverySecurityIntegrationTest extends BaseIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordRecoveryRateLimiter limits;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean EmailService email;
    private User actor;

    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM password_recovery_limits");
        actor = createUser("recovery-" + UUID.randomUUID() + "@example.com", "Password123!", "recovery");
    }
    @AfterEach void cleanup() {
        passwordResetTokenRepository.deleteAll(passwordResetTokenRepository.findAll().stream()
                .filter(t -> t.getUser().getId().equals(actor.getId())).toList());
        userRepository.deleteById(actor.getId());
        jdbc.update("DELETE FROM password_recovery_limits");
    }
    private org.springframework.test.web.servlet.MvcResult call(String path, Map<String, Object> body, String source) throws Exception {
        return mockMvc.perform(post("/api/auth/" + path).contentType(json()).content(asJson(body))
                .with(r -> { r.setRemoteAddr(source); return r; })).andReturn();
    }
    private String publicResponse(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        var body = objectMapper.readTree(result.getResponse().getContentAsString());
        return result.getResponse().getStatus() + ":" + body.path("success") + ":" + body.path("message") + ":" + body.path("fieldErrors");
    }
    private org.springframework.test.web.servlet.MvcResult verifyCode(String code, boolean only, String source) throws Exception {
        return call("reset-password", Map.of("email", actor.getEmail(), "otp", code, "verifyOnly", only,
                "newPassword", "NewPassword123!", "confirmPassword", "NewPassword123!"), source);
    }
    private PasswordResetToken seedCode() {
        var token = new PasswordResetToken(); token.setUser(actor); token.setToken(passwordEncoder.encode("123456"));
        token.setExpiresAt(Instant.now().plusSeconds(900)); return passwordResetTokenRepository.saveAndFlush(token);
    }
    private String sentCode(int count) {
        var text = ArgumentCaptor.forClass(String.class);
        verify(email, timeout(5000).times(count)).sendEmail(eq(actor.getEmail()), anyString(), text.capture());
        var match = Pattern.compile("code is: ([0-9]{6})").matcher(text.getValue());
        assertTrue(match.find()); return match.group(1);
    }
    private void permitNextResend(String address) {
        jdbc.update("UPDATE password_recovery_limits SET next_allowed_at=clock_timestamp() - INTERVAL '1 second' WHERE bucket_key=?",
                PasswordRecoveryRateLimiter.bucketKey("request-account", address));
        jdbc.update("UPDATE password_reset_tokens SET created_at=clock_timestamp() - INTERVAL '61 seconds' WHERE user_id=?", actor.getId());
    }
    @Test void successfulIssuanceVerificationAndResetKeepTheApiAndConsumeTheCode() throws Exception {
        assertEquals(200, call("forgot-password", Map.of("email", actor.getEmail().toUpperCase(Locale.ROOT)), "192.0.2.1").getResponse().getStatus());
        String code = sentCode(1);
        assertEquals(200, verifyCode(code, true, "192.0.2.1").getResponse().getStatus());
        assertTrue(passwordEncoder.matches("Password123!", userRepository.findById(actor.getId()).orElseThrow().getPassword()));
        assertEquals(200, verifyCode(code, false, "192.0.2.1").getResponse().getStatus());
        assertTrue(passwordEncoder.matches("NewPassword123!", userRepository.findById(actor.getId()).orElseThrow().getPassword()));
        assertTrue(passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).isEmpty());
        assertEquals(400, verifyCode(code, false, "192.0.2.1").getResponse().getStatus());
    }
    @Test void fiveFailuresPersistAcrossRequestsAndInvalidateBothVerificationModes() throws Exception {
        var token = seedCode();
        String error = null;
        for (int i = 0; i < 5; i++) {
            var result = verifyCode("000000", i % 2 == 0, "192.0.2.2");
            assertEquals(400, result.getResponse().getStatus());
            if (error == null) error = publicResponse(result);
            assertEquals(error, publicResponse(result));
        }
        var persisted = passwordResetTokenRepository.findById(token.getId()).orElseThrow();
        assertEquals(5, persisted.getFailedAttempts()); assertFalse(persisted.getExpiresAt().isAfter(Instant.now()));
        assertEquals(400, verifyCode("123456", true, "192.0.2.2").getResponse().getStatus());
        assertEquals(400, verifyCode("123456", false, "192.0.2.2").getResponse().getStatus());
    }
    @Test void concurrentWrongGuessesCannotLoseIncrementsOrExceedTheChallengeBudget() throws Exception {
        var token = seedCode();
        var statuses = parallel(12, i -> {
            try { return verifyCode("000000", true, "192.0.2.3").getResponse().getStatus(); }
            catch (Exception e) { throw new RuntimeException(e); }
        });
        assertTrue(statuses.stream().allMatch(s -> s == 400));
        assertEquals(5, passwordResetTokenRepository.findById(token.getId()).orElseThrow().getFailedAttempts());
        assertEquals(400, verifyCode("123456", true, "192.0.2.3").getResponse().getStatus());
    }
    @Test void successfulVerifyOnlyDoesNotRestoreFailedGuessAllowance() throws Exception {
        var token = seedCode();
        jdbc.update("UPDATE password_reset_tokens SET failed_attempts=4 WHERE id=?", token.getId());
        assertEquals(200, verifyCode("123456", true, "192.0.2.41").getResponse().getStatus());
        assertEquals(400, verifyCode("000000", true, "192.0.2.41").getResponse().getStatus());
        assertEquals(5, passwordResetTokenRepository.findById(token.getId()).orElseThrow().getFailedAttempts());
        assertEquals(400, verifyCode("123456", false, "192.0.2.41").getResponse().getStatus());
    }
    @Test void resendAfterCooldownReplacesTheChallengeWithAFreshGuessAllowance() throws Exception {
        var previous = seedCode();
        jdbc.update("UPDATE password_reset_tokens SET failed_attempts=4, created_at=clock_timestamp()-INTERVAL '61 seconds' WHERE id=?", previous.getId());
        assertEquals(200, call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.42").getResponse().getStatus());
        String code = sentCode(1);
        var current = passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).orElseThrow();
        assertNotEquals(previous.getId(), current.getId()); assertEquals(0, current.getFailedAttempts());
        assertEquals(200, verifyCode(code, false, "192.0.2.42").getResponse().getStatus());
    }
    @Test void slowEmailDoesNotDelayThePublicResponseOrRevealEligibility() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var finished = new CountDownLatch(1);
        doAnswer(inv -> {
            entered.countDown();
            try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
            finally { finished.countDown(); }
            return null;
        }).when(email).sendEmail(anyString(), anyString(), anyString());
        try {
            var known = call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.43");
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            var unknown = call("forgot-password", Map.of("email", "absent@example.com"), "192.0.2.43");
            assertEquals(200, known.getResponse().getStatus());
            assertEquals(publicResponse(known), publicResponse(unknown));
        } finally { release.countDown(); assertTrue(finished.await(5, TimeUnit.SECONDS)); }
    }
    @Test void simultaneousSuccessfulResetsConsumeTheChallengeOnlyOnce() throws Exception {
        seedCode();
        var statuses = parallel(2, i -> {
            try { return verifyCode("123456", false, "192.0.2.4").getResponse().getStatus(); }
            catch (Exception e) { throw new RuntimeException(e); }
        });
        assertEquals(List.of(200, 400), statuses.stream().sorted().toList());
    }
    @Test void resendCooldownPreservesCodeAndDoesNotSendAnotherEmail() throws Exception {
        var first = call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.5");
        String code = sentCode(1);
        var token = passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).orElseThrow();
        var second = call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.6");
        assertEquals(publicResponse(first), publicResponse(second));
        assertEquals(token.getId(), passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).orElseThrow().getId());
        verify(email, times(1)).sendEmail(anyString(), anyString(), anyString());
        assertEquals(200, verifyCode(code, true, "192.0.2.5").getResponse().getStatus());
    }
    @Test void accountIssuanceLimitSurvivesSourceRotationAndResetsAfterTheWindow() throws Exception {
        for (int i = 1; i <= 5; i++) {
            permitNextResend(actor.getEmail());
            assertEquals(200, call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2." + i).getResponse().getStatus());
            sentCode(i);
        }
        permitNextResend(actor.getEmail());
        assertEquals(200, call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.50").getResponse().getStatus());
        verify(email, times(5)).sendEmail(anyString(), anyString(), anyString());
        jdbc.update("UPDATE password_recovery_limits SET window_started_at=clock_timestamp() - INTERVAL '61 minutes' WHERE bucket_key=?",
                PasswordRecoveryRateLimiter.bucketKey("request-account", actor.getEmail()));
        assertEquals(200, call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.50").getResponse().getStatus());
        sentCode(6);
    }
    @Test void requestSourceLimitCoversUnknownAccountsAndIgnoresForgedForwardingHeaders() throws Exception {
        for (int i = 0; i < 20; i++) assertEquals(200,
                call("forgot-password", Map.of("email", "absent" + i + "@example.com"), "192.0.2.7").getResponse().getStatus());
        var result = mockMvc.perform(post("/api/auth/forgot-password").contentType(json())
                .content(asJson(Map.of("email", actor.getEmail()))).header("X-Forwarded-For", "198.51.100.99")
                .with(r -> { r.setRemoteAddr("192.0.2.7"); return r; })).andReturn();
        assertEquals(429, result.getResponse().getStatus());
        verifyNoInteractions(email);
    }
    @Test void verifyOnlySuccessCannotBypassAccountRequestLimit() throws Exception {
        seedCode();
        for (int i = 0; i < 20; i++) assertEquals(200, verifyCode("123456", true, "192.0.2." + i).getResponse().getStatus());
        assertEquals(429, verifyCode("123456", false, "192.0.2.90").getResponse().getStatus());
        jdbc.update("UPDATE password_recovery_limits SET window_started_at=clock_timestamp() - INTERVAL '16 minutes' WHERE bucket_key=?",
                PasswordRecoveryRateLimiter.bucketKey("verify-account", actor.getEmail()));
        assertEquals(200, verifyCode("123456", false, "192.0.2.90").getResponse().getStatus());
    }
    @Test void verificationSourceLimitCoversRotatingAccounts() throws Exception {
        for (int i = 0; i < 100; i++) limits.checkVerification("absent" + i + "@example.com", "192.0.2.8");
        assertEquals(429, verifyCode("123456", true, "192.0.2.8").getResponse().getStatus());
    }
    @Test void unknownProviderOnlyMissingExpiredAndIncorrectCodesSharePublicResponses() throws Exception {
        var known = call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.9"); sentCode(1);
        var unknown = call("forgot-password", Map.of("email", "absent@example.com"), "192.0.2.9");
        assertEquals(known.getResponse().getStatus(), unknown.getResponse().getStatus());
        assertEquals(publicResponse(known), publicResponse(unknown));
        var wrong = verifyCode("000000", true, "192.0.2.9");
        var missing = call("reset-password", Map.of("email", "absent@example.com", "otp", "000000", "verifyOnly", true), "192.0.2.9");
        assertEquals(publicResponse(wrong), publicResponse(missing));
        jdbc.update("UPDATE password_reset_tokens SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE user_id=?", actor.getId());
        assertEquals(publicResponse(wrong), publicResponse(verifyCode("123456", true, "192.0.2.9")));
        actor.setAuthProvider(AuthProvider.GOOGLE); userRepository.saveAndFlush(actor);
        permitNextResend(actor.getEmail());
        assertEquals(publicResponse(known), publicResponse(call("forgot-password", Map.of("email", actor.getEmail()), "192.0.2.9")));
        assertEquals(publicResponse(wrong), publicResponse(verifyCode("123456", true, "192.0.2.9")));
        verify(email, times(1)).sendEmail(anyString(), anyString(), anyString());
    }
    @Test void concurrentFirstRequestsIssueOnlyOneChallengeAcrossSources() throws Exception {
        var statuses = parallel(8, i -> {
            try { return call("forgot-password", Map.of("email", actor.getEmail()), "198.51.100." + i).getResponse().getStatus(); }
            catch (Exception e) { throw new RuntimeException(e); }
        });
        assertTrue(statuses.stream().allMatch(s -> s == 200)); sentCode(1);
        assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens WHERE user_id=?", Long.class, actor.getId()));
    }
    @Test void independentLimiterInstancesShareAnAtomicSourceBudget() throws Exception {
        var firstInstance = new PasswordRecoveryRateLimiter(jdbc);
        var secondInstance = new PasswordRecoveryRateLimiter(jdbc);
        var results = parallel(24, i -> new TransactionTemplate(transactionManager).execute(status -> {
            try { return (i % 2 == 0 ? firstInstance : secondInstance).allowRequest("absent" + i + "@example.com", "192.0.2.10"); }
            catch (org.springframework.web.server.ResponseStatusException e) { assertEquals(429, e.getStatusCode().value()); return false; }
        }));
        assertEquals(20, results.stream().filter(Boolean::booleanValue).count());
    }
    @Test void schemaPatchPreservesLegacyChallengesAndCanRunTwice() throws Exception {
        String schema = "recovery_" + UUID.randomUUID().toString().replace("-", "");
        String sql;
        try (var resource = getClass().getResourceAsStream("/db/migration/V25__password_recovery_limits.sql")) {
            sql = new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                    .replace("password_reset_tokens", schema + ".password_reset_tokens")
                    .replace("password_recovery_limits", schema + ".password_recovery_limits");
        }
        // Do not rewrite the index's identifier along with its table's name.
        sql = sql.replace("idx_" + schema + ".password_recovery_limits_window", "idx_password_recovery_limits_window");
        jdbc.execute("CREATE SCHEMA " + schema);
        try {
            jdbc.execute("CREATE TABLE " + schema + ".password_reset_tokens(id TEXT PRIMARY KEY)");
            jdbc.execute("INSERT INTO " + schema + ".password_reset_tokens VALUES ('legacy')");
            jdbc.execute(sql); jdbc.execute(sql);
            assertEquals(0, jdbc.queryForObject("SELECT failed_attempts FROM " + schema + ".password_reset_tokens WHERE id='legacy'", Integer.class));
        } finally { jdbc.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }
    private <T> List<T> parallel(int count, IntFunction<T> action) throws Exception {
        var pool = Executors.newFixedThreadPool(Math.min(count, 12));
        var start = new CountDownLatch(1);
        try {
            List<Future<T>> work = new ArrayList<>();
            for (int i = 0; i < count; i++) { int n = i; work.add(pool.submit(() -> { start.await(); return action.apply(n); })); }
            start.countDown(); List<T> results = new ArrayList<>();
            for (var future : work) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
}
