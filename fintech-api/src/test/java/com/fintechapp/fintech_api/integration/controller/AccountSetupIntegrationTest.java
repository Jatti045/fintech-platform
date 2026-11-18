package com.fintechapp.fintech_api.integration.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class AccountSetupIntegrationTest extends BaseIntegrationTest {

  private static final String PASSWORD = "Password123!";
  private static final String SETUP_PATH = "/api/users/me/setup";

  @MockitoBean private GoogleIdTokenVerifier googleVerifier;
  @Autowired private JdbcTemplate jdbc;

  private String committedAccountEmail;

  @AfterEach
  void removeCommittedAccount() throws Exception {
    if (committedAccountEmail == null) return;
    var account = userRepository.findByEmail(committedAccountEmail);
    if (account.isPresent()) {
      var user = account.get();
      mockMvc
          .perform(
              delete("/api/users/{userId}", user.getId())
                  .header(authHeaderName(), authHeader(user)))
          .andExpect(status().isOk());
    }
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void emailSignupRequiresSetupAcrossSessionsAndSavesCadIncomeExactlyOnce() throws Exception {
    String email = "setup-email@example.com";
    committedAccountEmail = email;
    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(json())
                .content(
                    asJson(
                        Map.of(
                            "username",
                            "New user",
                            "email",
                            email,
                            "password",
                            PASSWORD,
                            "confirmPassword",
                            PASSWORD))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.setupComplete").value(false));

    login(email, false);
    String secondSession = login(email, false);
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), secondSession)
                .contentType(json())
                .content("{\"monthlyIncome\":3500.75,\"currency\":\"CAD\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    String anotherDevice = login(email, true);
    // Replaying a request cannot overwrite the winning setup or create a second baseline.
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), anotherDevice)
                .contentType(json())
                .content("{\"monthlyIncome\":42,\"currency\":\"GBP\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    var currentMonth = LocalDate.now(ZoneOffset.UTC);
    mockMvc
        .perform(
            get("/api/users/me/monthly-income")
                .header(authHeaderName(), anotherDevice)
                .param("year", String.valueOf(currentMonth.getYear()))
                .param("month", String.valueOf(currentMonth.getMonthValue() - 1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.monthlyIncome").value(3500.75))
        .andExpect(jsonPath("$.data.currency").value("CAD"));

    String userId = userRepository.findByEmail(email).orElseThrow().getId();
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_monthly_incomes WHERE user_id = ?", Integer.class, userId));

    mockMvc
        .perform(
            post("/api/transactions")
                .header(authHeaderName(), anotherDevice)
                .contentType(json())
                .content(
                    asJson(
                        Map.of(
                            "name",
                            "Pay",
                            "month",
                            currentMonth.getMonthValue() - 1,
                            "year",
                            currentMonth.getYear(),
                            "date",
                            currentMonth + "T12:00:00Z",
                            "category",
                            "Income",
                            "type",
                            "INCOME",
                            "amount",
                            10))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.transaction.baseCurrency").value("CAD"))
        .andExpect(jsonPath("$.data.transaction.originalCurrency").value("CAD"));
  }

  @Test
  void firstGoogleSignInRequiresSetupAndAcceptsExplicitZero() throws Exception {
    var token = mock(GoogleIdToken.class);
    var payload = new GoogleIdToken.Payload().setEmail("setup-google@example.com");
    payload.set("name", "Google User");
    when(token.getPayload()).thenReturn(payload);
    when(googleVerifier.verify("mock-google-token")).thenReturn(token);
    String header = googleLogin(false);

    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), header)
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"EUR\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(0))
        .andExpect(jsonPath("$.data.currency").value("EUR"));

    mockMvc
        .perform(get("/api/auth/me").header(authHeaderName(), googleLogin(true)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.currency").value("EUR"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":-1,\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":\"bad\",\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":1e1000,\"currency\":\"CAD\"}",
        "{\"monthlyIncome\":42,\"currency\":\"XYZ\"}"
      })
  void invalidSetupLeavesBothSettingsUnchanged(String body) throws Exception {
    var user = createUser("invalid-setup@example.com", PASSWORD, "Invalid setup");
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), authHeader(user))
                .contentType(json())
                .content(body))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(get("/api/auth/me").header(authHeaderName(), authHeader(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(false))
        .andExpect(jsonPath("$.data.monthlyIncome").value(0))
        .andExpect(jsonPath("$.data.currency").value("USD"));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_monthly_incomes WHERE user_id = ?",
            Integer.class,
            user.getId()));
  }

  @Test
  void grandfatheredAccountKeepsExistingSettings() throws Exception {
    var user = createUser("existing-setup@example.com", PASSWORD, "Existing");
    user.setSetupComplete(true);
    user.setCurrency("GBP");
    var monthStart =
        LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    createMonthlyIncome(user, monthStart, 1200);

    mockMvc
        .perform(
            patch(SETUP_PATH)
                .header(authHeaderName(), login(user.getEmail(), true))
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"USD\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.setupComplete").value(true))
        .andExpect(jsonPath("$.data.monthlyIncome").value(1200))
        .andExpect(jsonPath("$.data.currency").value("GBP"));
  }

  @Test
  void setupRequiresAuthentication() throws Exception {
    mockMvc
        .perform(
            patch(SETUP_PATH)
                .contentType(json())
                .content("{\"monthlyIncome\":0,\"currency\":\"CAD\"}"))
        .andExpect(status().isUnauthorized());
  }

  private String login(String email, boolean completed) throws Exception {
    var response =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(json())
                    .content(asJson(Map.of("email", email, "password", PASSWORD))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.setupComplete").value(completed))
            .andReturn()
            .getResponse();
    return "Bearer "
        + objectMapper.readTree(response.getContentAsString()).at("/data/token").asString();
  }

  private String googleLogin(boolean completed) throws Exception {
    var response =
        mockMvc
            .perform(
                post("/api/auth/google")
                    .contentType(json())
                    .content("{\"idToken\":\"mock-google-token\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.setupComplete").value(completed))
            .andReturn()
            .getResponse();
    return "Bearer "
        + objectMapper.readTree(response.getContentAsString()).at("/data/token").asString();
  }
}
