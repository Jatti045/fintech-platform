package com.fintechapp.fintech_api.integration.controller;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PasswordResetToken;
import com.fintechapp.fintech_api.model.User;

class AuthControllerIntegrationTest extends BaseIntegrationTest {

    // Asserts signup succeeds with valid payload and persists the new user.
    @Test
    void signup_validRequest_createsUser() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "username", "alice",
                                "email", "alice@example.com",
                                "password", "Password123!",
                                "confirmPassword", "Password123!"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id", notNullValue()))
                .andExpect(jsonPath("$.data.email").value("alice@example.com"));
    }

    // Asserts signup rejects missing required fields with the expected 400 response shape.
    @Test
    void signup_missingRequiredField_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "username", "alice",
                                "email", "alice@example.com",
                                "password", "Password123!"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts login succeeds for an existing user and returns a JWT token.
    @Test
    void login_validCredentials_returnsToken() throws Exception {
        createUser("bob@example.com", "Password123!", "bob");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "email", "bob@example.com",
                                "password", "Password123!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token", notNullValue()));
    }

    // Asserts login with invalid password fails with 400 and API error shape.
    @Test
    void login_invalidPassword_returnsBadRequest() throws Exception {
        createUser("charlie@example.com", "Password123!", "charlie");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "email", "charlie@example.com",
                                "password", "WrongPassword"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // Asserts login with an unknown email returns the SAME generic message as a
    // wrong password, so the endpoint cannot be used to enumerate accounts.
    @Test
    void login_unknownEmail_returnsGenericMessageIdenticalToWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "email", "nobody@example.com",
                                "password", "Whatever123"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid email or password."));
    }

    // Asserts forgot-password succeeds when user exists.
    @Test
    void forgotPassword_existingEmail_returnsSuccess() throws Exception {
        createUser("dana@example.com", "Password123!", "dana");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(json())
                        .content(asJson(Map.of("email", "dana@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // Asserts reset-password verify-only flow succeeds when OTP matches latest token.
    @Test
    void resetPassword_verifyOnlyValidOtp_returnsSuccess() throws Exception {
        User user = createUser("eric@example.com", "Password123!", "eric");

        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setToken(passwordEncoder.encode("123456"));
        token.setExpiresAt(Instant.now().plusSeconds(600));
        passwordResetTokenRepository.save(token);

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "email", "eric@example.com",
                                "otp", "123456",
                                "verifyOnly", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // Asserts protected /me endpoint requires authentication.
    @Test
    void getCurrentUser_noToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("No token provided."));
    }

    // Asserts protected /me endpoint returns current authenticated user for valid JWT.
    @Test
    void getCurrentUser_validToken_returnsUser() throws Exception {
        User user = createUser("frank@example.com", "Password123!", "frank");

        mockMvc.perform(get("/api/auth/me")
                        .header(authHeaderName(), authHeader(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(user.getId()))
                .andExpect(jsonPath("$.data.email").value("frank@example.com"));
    }

    // Asserts reset-password updates persisted password hash when verifyOnly=false.
    @Test
    void resetPassword_validOtpAndNewPassword_updatesPassword() throws Exception {
        User user = createUser("gina@example.com", "Password123!", "gina");

        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setToken(passwordEncoder.encode("654321"));
        token.setExpiresAt(Instant.now().plusSeconds(600));
        passwordResetTokenRepository.save(token);

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(json())
                        .content(asJson(Map.of(
                                "email", "gina@example.com",
                                "otp", "654321",
                                "newPassword", "NewPassword123!",
                                "confirmPassword", "NewPassword123!",
                                "verifyOnly", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(
                passwordEncoder.matches("NewPassword123!", reloaded.getPassword())
        );
    }

    // TODO: RBAC is not implemented in current security config (no role claims/authorities checks).
    // This placeholder marks required 403 wrong-role coverage once role-based access is introduced.
    @Disabled("TODO: Enable when endpoint-level role authorization is implemented")
    @Test
    void getCurrentUser_validTokenWrongRole_returnsForbidden() {
    }
}

