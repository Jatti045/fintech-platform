package com.fintechapp.fintech_api.integration.controller;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.security.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.dto.user.ChangePasswordRequest;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Separate committed transactions exercise persistence, HTTP security, and writer races. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SessionRevocationIntegrationTest extends BaseIntegrationTest {
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserService users;
    @Autowired AuthService auth;
    @Autowired PlatformTransactionManager manager;
    @Value("${app.jwt.secret-key}") String secret;
    private User actor;
    private User other;

    @BeforeEach void prepare() {
        actor = createUser("sessions-" + UUID.randomUUID() + "@example.com", "Password123!", "sessions");
        other = createUser("other-" + UUID.randomUUID() + "@example.com", "Password123!", "other");
        jdbc.update("DELETE FROM password_recovery_limits");
    }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id IN (?,?)", actor.getId(), other.getId());
        userRepository.deleteById(actor.getId()); userRepository.deleteById(other.getId());
        jdbc.update("DELETE FROM password_recovery_limits");
    }
    private String login(User user, String password) throws Exception {
        var response = mockMvc.perform(post("/api/auth/login").contentType(json())
                .content(asJson(Map.of("email", user.getEmail(), "password", password))))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(response.getResponse().getContentAsString()).path("data").path("token").asString();
    }
    private void current(String token, int expected) throws Exception {
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().is(expected));
    }
    private org.springframework.test.web.servlet.ResultActions change(String token, String before, String after) throws Exception {
        return mockMvc.perform(patch("/api/users/me/password").header("Authorization", "Bearer " + token).contentType(json())
                .content(asJson(Map.of("currentPassword", before, "newPassword", after, "confirmPassword", after))));
    }
    private void seedChallenge() {
        var token = new PasswordResetToken(); token.setUser(actor); token.setToken(passwordEncoder.encode("123456"));
        token.setExpiresAt(Instant.now().plusSeconds(900)); passwordResetTokenRepository.saveAndFlush(token);
    }
    private org.springframework.test.web.servlet.ResultActions reset(boolean verifyOnly, String confirmation) throws Exception {
        return mockMvc.perform(post("/api/auth/reset-password").contentType(json()).content(asJson(Map.of(
                "email", actor.getEmail(), "otp", "123456", "verifyOnly", verifyOnly,
                "newPassword", "NewPassword123!", "confirmPassword", confirmation))));
    }
    @Test void passwordChangeRevokesEveryOldTokenAndChallengeButFreshLoginWorks() throws Exception {
        String first = login(actor, "Password123!"); String second = login(actor, "Password123!");
        String unaffected = login(other, "Password123!"); seedChallenge();
        change(first, "Password123!", "NewPassword123!").andExpect(status().isOk());
        assertEquals(1, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
        current(first, 401); current(second, 401); current(unaffected, 200);
        assertTrue(passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).isEmpty());
        reset(true, "NewPassword123!").andExpect(status().isBadRequest());
        String fresh = login(actor, "NewPassword123!"); current(fresh, 200);
        mockMvc.perform(post("/api/auth/login").contentType(json()).content(asJson(Map.of("email", actor.getEmail(), "password", "Password123!"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/budgets").queryParam("month", "9").queryParam("year", "2026")
                .header("Authorization", "Bearer " + first)).andExpect(status().isUnauthorized());
    }
    @Test void passwordResetRevokesOldTokensAndOnlyNewLoginsAreAccepted() throws Exception {
        String old = login(actor, "Password123!"); seedChallenge();
        reset(false, "NewPassword123!").andExpect(status().isOk());
        current(old, 401); assertEquals(1, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
        String fresh = login(actor, "NewPassword123!"); current(fresh, 200);
        assertTrue(passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).isEmpty());
    }
    @Test void repeatedChangesAdvanceTheVersionAndRevokeThePreviousGeneration() throws Exception {
        String zero = login(actor, "Password123!");
        change(zero, "Password123!", "NewPassword123!").andExpect(status().isOk());
        String one = login(actor, "NewPassword123!");
        change(one, "NewPassword123!", "AnotherPassword123!").andExpect(status().isOk());
        current(zero, 401); current(one, 401);
        current(login(actor, "AnotherPassword123!"), 200);
        assertEquals(2, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
    }
    @Test void invalidPasswordOperationsAndVerifyOnlyDoNotRevokeSessionsOrDeleteChallenges() throws Exception {
        String token = login(actor, "Password123!"); seedChallenge();
        change(token, "IncorrectPassword!", "NewPassword123!").andExpect(status().isBadRequest());
        reset(false, "DifferentPassword123!").andExpect(status().isBadRequest());
        reset(true, "NewPassword123!").andExpect(status().isOk());
        current(token, 200);
        assertEquals(0, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
        assertTrue(passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).isPresent());
    }
    @Test void independentAndRecreatedValidatorsReadTheCommittedVersion() throws Exception {
        var secondInstance = new JwtService(userRepository);
        ReflectionTestUtils.setField(secondInstance, "secretKey", secret);
        String old = login(actor, "Password123!"); secondInstance.authenticate(old);
        change(old, "Password123!", "NewPassword123!").andExpect(status().isOk());
        assertEquals(401, assertThrows(TokenAuthenticationException.class, () -> secondInstance.authenticate(old)).getStatus().value());
        var restarted = new JwtService(userRepository);
        ReflectionTestUtils.setField(restarted, "secretKey", secret);
        assertThrows(TokenAuthenticationException.class, () -> restarted.authenticate(old));
        assertEquals(1, restarted.authenticate(login(actor, "NewPassword123!")).sessionVersion());
    }
    @Test void staleProfileEntityCannotRestoreThePasswordOrSessionVersion() throws Exception {
        String old = login(actor, "Password123!");
        // A detached profile snapshot models an upload started before the reset.
        User stale = userRepository.findById(actor.getId()).orElseThrow();
        change(old, "Password123!", "NewPassword123!").andExpect(status().isOk());
        stale.setProfilePic("https://example.com/profile.png");
        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class,
                () -> userRepository.saveAndFlush(stale));
        User current = userRepository.findById(actor.getId()).orElseThrow();
        assertEquals(1, current.getSessionVersion());
        assertTrue(passwordEncoder.matches("NewPassword123!", current.getPassword()));
        current(old, 401); current(login(actor, "NewPassword123!"), 200);
    }
    @Test void passwordAndRevocationRollBackTogetherIfTheTransactionFails() throws Exception {
        String old = login(actor, "Password123!"); seedChallenge();
        assertThrows(IllegalStateException.class, () -> new TransactionTemplate(manager).execute(status -> {
            users.changePassword(jwt.authenticate(old), new ChangePasswordRequest("Password123!", "NewPassword123!", "NewPassword123!"));
            throw new IllegalStateException("Simulated transaction failure");
        }));
        current(old, 200); assertEquals(0, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
        assertTrue(passwordResetTokenRepository.findFirstByUser_IdOrderByCreatedAtDesc(actor.getId()).isPresent());
        current(login(actor, "Password123!"), 200);
    }
    @Test void principalAdmittedBeforeAnotherChangeCannotChangeThePasswordAfterRevocation() throws Exception {
        String old = login(actor, "Password123!"); var admitted = jwt.authenticate(old);
        change(old, "Password123!", "NewPassword123!").andExpect(status().isOk());
        var error = assertThrows(TokenAuthenticationException.class, () -> users.changePassword(admitted,
                new ChangePasswordRequest("NewPassword123!", "AnotherPassword123!", "AnotherPassword123!")));
        assertEquals(401, error.getStatus().value());
        assertEquals(1, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
    }
    @Test void loginCannotMintANewVersionFromCredentialsReadBeforeAChange() throws Exception {
        String old = login(actor, "Password123!");
        var locked = new CountDownLatch(1); var release = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var writer = pool.submit(() -> new TransactionTemplate(manager).execute(status -> {
                users.changePassword(jwt.authenticate(old), new ChangePasswordRequest("Password123!", "NewPassword123!", "NewPassword123!"));
                locked.countDown();
                try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
                return null;
            }));
            assertTrue(locked.await(5, TimeUnit.SECONDS));
            var started = new CountDownLatch(1);
            var reader = pool.submit(() -> {
                started.countDown();
                try {
                    return mockMvc.perform(post("/api/auth/login").contentType(json())
                            .content(asJson(Map.of("email", actor.getEmail(), "password", "Password123!"))))
                            .andReturn().getResponse().getStatus();
                } catch (Exception e) { throw new RuntimeException(e); }
            });
            assertTrue(started.await(5, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> reader.get(150, TimeUnit.MILLISECONDS));
            release.countDown(); writer.get(10, TimeUnit.SECONDS);
            assertEquals(400, reader.get(10, TimeUnit.SECONDS));
            current(login(actor, "NewPassword123!"), 200);
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void concurrentResetAndPasswordChangeCommitExactlyOneCredentialGeneration() throws Exception {
        String old = login(actor, "Password123!"); seedChallenge();
        var start = new CountDownLatch(1); var pool = Executors.newFixedThreadPool(2);
        try {
            var changing = pool.submit(() -> {
                start.await();
                return change(old, "Password123!", "NewPassword123!").andReturn().getResponse().getStatus();
            });
            var resetting = pool.submit(() -> {
                start.await(); return reset(false, "NewPassword123!").andReturn().getResponse().getStatus();
            });
            start.countDown();
            var statuses = List.of(changing.get(10, TimeUnit.SECONDS), resetting.get(10, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(s -> s == 200).count());
            assertTrue(statuses.stream().allMatch(s -> s == 200 || s == 400 || s == 401));
            assertEquals(1, userRepository.findSessionVersionById(actor.getId()).orElseThrow());
            current(old, 401); current(login(actor, "NewPassword123!"), 200);
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void legacyVersionlessJwtIsRevokedAfterTheFirstPasswordUpdate() throws Exception {
        var encoder = java.util.Base64.getUrlEncoder().withoutPadding();
        String payload = asJson(Map.of("userId", actor.getId(), "email", actor.getEmail(), "iat", Instant.now().getEpochSecond()));
        String unsigned = encoder.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8))
                + "." + encoder.encodeToString(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        String legacy = unsigned + "." + encoder.encodeToString(mac.doFinal(unsigned.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        current(legacy, 200);
        change(legacy, "Password123!", "NewPassword123!").andExpect(status().isOk());
        current(legacy, 401); current(login(actor, "NewPassword123!"), 200);
    }
    @Test void migrationPreservesExistingAccountsAndIsIdempotent() throws Exception {
        String schema = "sessions_" + UUID.randomUUID().toString().replace("-", "");
        String sql;
        try (var resource = getClass().getResourceAsStream("/db/migration/V26__user_session_version.sql")) {
            sql = new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).replace("ALTER TABLE users", "ALTER TABLE " + schema + ".users");
        }
        jdbc.execute("CREATE SCHEMA " + schema);
        try {
            jdbc.execute("CREATE TABLE " + schema + ".users(id TEXT PRIMARY KEY, password TEXT)");
            jdbc.execute("INSERT INTO " + schema + ".users VALUES ('legacy', 'hash')");
            jdbc.execute(sql); jdbc.execute(sql);
            assertEquals(0L, jdbc.queryForObject("SELECT session_version FROM " + schema + ".users", Long.class));
            assertEquals("hash", jdbc.queryForObject("SELECT password FROM " + schema + ".users", String.class));
        } finally { jdbc.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }
}
