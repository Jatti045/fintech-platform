package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import com.fintechapp.fintech_api.dto.auth.GoogleAuthRequest;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.GoogleIdentityChallengeRepository;
import com.fintechapp.fintech_api.security.GoogleIdentityVerifier;
import com.fintechapp.fintech_api.security.GoogleIdentityVerifier.Identity;
import com.fintechapp.fintech_api.service.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class GoogleIdentityIntegrationTest extends BaseIntegrationTest {
    @MockitoBean private GoogleIdentityVerifier verifier;
    @MockitoBean private EmailService mail;
    @Autowired private GoogleIdentityService google;
    @Autowired private GoogleIdentityChallengeRepository challenges;
    @Autowired private JdbcTemplate jdbc;
    private String run;
    private String source;

    @BeforeEach void prepare() { run = UUID.randomUUID().toString(); source = "2001:db8::" + run.substring(0, 4) + ":" + run.substring(4, 8); }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM google_identity_challenges WHERE email LIKE ?", run + "%");
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)", run + "%");
        jdbc.update("DELETE FROM users WHERE email LIKE ?", run + "%");
    }
    private String address(String name) { return run + name + "@gmail.com"; }
    private Identity identity(String suffix, String email, boolean authority) {
        var identity = new Identity(run + suffix, email, "Person", authority);
        when(verifier.verify(suffix)).thenReturn(identity); return identity;
    }
    private MockHttpServletRequestBuilder request(String path, Map<String, Object> body) throws Exception {
        return post(path).with(r -> { r.setRemoteAddr(source); return r; }).contentType(json()).content(asJson(body));
    }
    private JsonNode signIn(String token) throws Exception { return signIn(token, null); }
    private JsonNode signIn(String token, String code) throws Exception {
        Map<String, Object> body = new HashMap<>(); body.put("idToken", token);
        if (code != null) body.put("verificationCode", code);
        String content = mockMvc.perform(request("/api/auth/google", body)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(content).get("data");
    }
    private String issue(String token) throws Exception {
        mockMvc.perform(request("/api/auth/google/verification-code", Map.of("idToken", token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        var body = ArgumentCaptor.forClass(String.class);
        verify(mail, timeout(5000)).sendEmail(anyString(), eq("Google sign-in verification code"), body.capture());
        var matcher = Pattern.compile("code is: ([0-9]{6})").matcher(body.getValue());
        assertTrue(matcher.find()); return matcher.group(1);
    }
    private User legacy(String email) {
        User user = new User(); user.setEmail(email); user.setUsername("Original"); user.setAuthProvider(AuthProvider.GOOGLE);
        return userRepository.saveAndFlush(user);
    }
    private String userId(JsonNode data) { return data.get("user").get("id").asString(); }

    @Test void newAuthoritativeAccountIsRegisteredWithSubjectAndValidSession() throws Exception {
        var identity = identity("new", address("new"), true);
        var data = signIn("new");
        User saved = userRepository.findById(userId(data)).orElseThrow();
        assertEquals(identity.subject(), saved.getGoogleSubject()); assertEquals(AuthProvider.GOOGLE, saved.getAuthProvider());
        assertNull(saved.getPassword());
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + data.get("token").asString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(saved.getId()));
        verifyNoInteractions(mail);
    }
    @Test void returningSubjectKeepsSameAccountAcrossGoogleEmailChangesAndCollisions() throws Exception {
        var original = identity("original", address("original"), true);
        String id = userId(signIn("original"));
        User other = createUser(address("other"), "Password123!", "Other");
        when(verifier.verify("changed")).thenReturn(new Identity(original.subject(), other.getEmail(), "Changed", false));
        assertEquals(id, userId(signIn("changed")));
        User unchanged = userRepository.findById(id).orElseThrow();
        assertEquals(original.email(), unchanged.getEmail()); assertEquals("Person", unchanged.getUsername());
        assertNull(userRepository.findById(other.getId()).orElseThrow().getGoogleSubject());
    }
    @Test void differentSubjectsWithSameEmailNeverMergeOrReplaceBinding() throws Exception {
        identity("first", address("same"), true); identity("second", address("same"), true);
        String id = userId(signIn("first"));
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "second"))).andExpect(status().isUnauthorized());
        mockMvc.perform(request("/api/auth/google/verification-code", Map.of("idToken", "second"))).andExpect(status().isOk());
        verifyNoInteractions(mail);
        assertEquals(run + "first", userRepository.findById(id).orElseThrow().getGoogleSubject());
    }
    @Test void passwordAccountRequiresFreshMailboxProofAndKeepsPasswordLogin() throws Exception {
        User passwordUser = createUser(address("password"), "Password123!", "Original");
        identity("link", passwordUser.getEmail(), true);
        String oldSession = authHeader(passwordUser);
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "link"))).andExpect(status().isUnauthorized());
        assertNull(userRepository.findById(passwordUser.getId()).orElseThrow().getGoogleSubject());
        String code = issue("link");
        assertNotEquals(code, challenges.findById(passwordUser.getEmail()).orElseThrow().getTokenHash());
        var data = signIn("link", code); assertEquals(passwordUser.getId(), userId(data));
        User linked = userRepository.findById(passwordUser.getId()).orElseThrow();
        assertEquals(AuthProvider.EMAIL, linked.getAuthProvider()); assertEquals(1, linked.getSessionVersion());
        assertTrue(passwordEncoder.matches("Password123!", linked.getPassword()));
        assertFalse(challenges.existsById(passwordUser.getEmail()));
        mockMvc.perform(get("/api/auth/me").header("Authorization", oldSession)).andExpect(status().isUnauthorized());
        mockMvc.perform(request("/api/auth/login", Map.of("email", linked.getEmail(), "password", "Password123!")))
                .andExpect(status().isOk());
    }
    @Test void legacyGoogleAccountRequiresProofBeforeBindingWithoutLosingAccount() throws Exception {
        User existing = legacy(address("legacy")); identity("migration", existing.getEmail(), true);
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "migration"))).andExpect(status().isUnauthorized());
        String code = issue("migration"); assertEquals(existing.getId(), userId(signIn("migration", code)));
        var migrated = userRepository.findById(existing.getId()).orElseThrow();
        assertEquals("Original", migrated.getUsername()); assertEquals(AuthProvider.GOOGLE, migrated.getAuthProvider());
        assertEquals(run + "migration", migrated.getGoogleSubject());
        assertEquals(existing.getId(), userId(signIn("migration")));
    }
    @Test void thirdPartyRegistrationRequiresCurrentMailboxProof() throws Exception {
        String email = run + "@external.example"; identity("external", email, false);
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "external"))).andExpect(status().isUnauthorized());
        assertFalse(userRepository.existsByEmail(email));
        String code = issue("external");
        assertEquals(email, signIn("external", code).get("user").get("email").asString());
    }
    @Test void proofCannotBeUsedForADifferentSubject() throws Exception {
        User existing = legacy(address("scope"));
        identity("owner", existing.getEmail(), true); identity("attacker", existing.getEmail(), true);
        String code = issue("owner");
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "attacker", "verificationCode", code)))
                .andExpect(status().isUnauthorized());
        assertNull(userRepository.findById(existing.getId()).orElseThrow().getGoogleSubject());
        assertEquals(1, challenges.findById(existing.getEmail()).orElseThrow().getFailedAttempts());
        assertEquals(existing.getId(), userId(signIn("owner", code)));
    }
    @Test void rejectedGuessesCommitAndExhaustChallenge() throws Exception {
        User existing = legacy(address("attempts")); identity("guess", existing.getEmail(), true);
        String code = issue("guess"); String wrong = code.equals("000000") ? "000001" : "000000";
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(request("/api/auth/google", Map.of("idToken", "guess", "verificationCode", wrong)))
                    .andExpect(status().isUnauthorized());
        }
        assertEquals(5, challenges.findById(existing.getEmail()).orElseThrow().getFailedAttempts());
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "guess", "verificationCode", code)))
                .andExpect(status().isUnauthorized());
        assertNull(userRepository.findById(existing.getId()).orElseThrow().getGoogleSubject());
    }
    @Test void expiredChallengeCannotBind() throws Exception {
        User existing = legacy(address("expired")); identity("expiry", existing.getEmail(), true);
        String code = issue("expiry");
        jdbc.update("UPDATE google_identity_challenges SET expires_at=? WHERE email=?", java.sql.Timestamp.from(Instant.now().minusSeconds(1)), existing.getEmail());
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "expiry", "verificationCode", code)))
                .andExpect(status().isUnauthorized());
    }
    @Test void challengeCannotAttachToAnAccountCreatedAfterIssuance() throws Exception {
        String email = run + "@external.example"; identity("race", email, false);
        String code = issue("race");
        User newlyRegistered = createUser(email, "Password123!", "New password user");
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "race", "verificationCode", code)))
                .andExpect(status().isUnauthorized());
        assertNull(userRepository.findById(newlyRegistered.getId()).orElseThrow().getGoogleSubject());
    }
    @Test void challengeRequestsAreGenericAndRateLimited() throws Exception {
        identity("rate", address("rate"), true);
        issue("rate");
        for (int i = 0; i < 19; i++) mockMvc.perform(request("/api/auth/google/verification-code", Map.of("idToken", "rate"))).andExpect(status().isOk());
        mockMvc.perform(request("/api/auth/google/verification-code", Map.of("idToken", "rate"))).andExpect(status().isTooManyRequests());
        verify(mail, times(1)).sendEmail(anyString(), anyString(), anyString());
    }
    @Test void invalidTokenAndMalformedCodeAreRejectedAtTheApiBoundary() throws Exception {
        when(verifier.verify("invalid")).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid Google identity token."));
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "invalid"))).andExpect(status().isUnauthorized());
        mockMvc.perform(request("/api/auth/google", Map.of("idToken", "anything", "verificationCode", "bad"))).andExpect(status().isBadRequest());
        mockMvc.perform(request("/api/auth/google/verification-code", Map.of("idToken", ""))).andExpect(status().isBadRequest());
        verify(verifier, never()).verify("anything");
    }
    @Test void concurrentFirstSignInsWithSameEmailCannotCreateOrMergeTwoAccounts() throws Exception {
        identity("concurrent-a", address("concurrent"), true); identity("concurrent-b", address("concurrent"), true);
        var pool = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            List<Future<String>> results = new ArrayList<>();
            for (String token : List.of("concurrent-a", "concurrent-b")) results.add(pool.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                try { return google.signIn(new GoogleAuthRequest(token), source).data().user().id(); }
                catch (ResponseStatusException ex) { assertEquals(401, ex.getStatusCode().value()); return "denied"; }
            }));
            start.countDown();
            assertEquals(1, results.stream().map(f -> { try { return f.get(15, TimeUnit.SECONDS); } catch (Exception e) { throw new AssertionError(e); }}).filter("denied"::equals).count());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email=?", Integer.class, address("concurrent")));
        } finally { pool.shutdownNow(); assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS)); }
    }
    @Test void databaseEnforcesUniqueSubjectsEvenForDirectWriters() throws Exception {
        var first = identity("unique", address("unique-a"), true); signIn("unique");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE users SET google_subject=? WHERE id=?", first.subject(), createUser(address("unique-b"), "Password123!", "Other").getId()));
    }
    @Test void ordinaryUserSavesCannotReplaceEstablishedGoogleBinding() throws Exception {
        identity("immutable", address("immutable"), true);
        String id = userId(signIn("immutable"));
        User detached = userRepository.findById(id).orElseThrow();
        detached.setGoogleSubject("attacker-subject"); detached.setUsername("Updated profile");
        userRepository.saveAndFlush(detached);
        assertEquals(run + "immutable", userRepository.findById(id).orElseThrow().getGoogleSubject());
        assertEquals("Updated profile", userRepository.findById(id).orElseThrow().getUsername());
    }
    @Test void linkedPasswordAccountRetainsRecoveryAndRevokesOldSessions() throws Exception {
        User existing = createUser(address("recovery"), "Password123!", "Original"); identity("recovery", existing.getEmail(), true);
        String code = issue("recovery"); var data = signIn("recovery", code);
        mockMvc.perform(request("/api/auth/forgot-password", Map.of("email", existing.getEmail()))).andExpect(status().isOk());
        var body = ArgumentCaptor.forClass(String.class);
        verify(mail, timeout(5000)).sendEmail(eq(existing.getEmail()), eq("Password reset code"), body.capture());
        var matcher = Pattern.compile("code is: ([0-9]{6})").matcher(body.getValue()); assertTrue(matcher.find());
        mockMvc.perform(request("/api/auth/reset-password", Map.of("email", existing.getEmail(), "otp", matcher.group(1),
                "newPassword", "NewPassword123!", "confirmPassword", "NewPassword123!"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + data.get("token").asString())).andExpect(status().isUnauthorized());
        mockMvc.perform(request("/api/auth/login", Map.of("email", existing.getEmail(), "password", "NewPassword123!"))).andExpect(status().isOk());
        assertEquals(existing.getId(), userId(signIn("recovery")));
    }
}
