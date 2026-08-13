package com.fintechapp.fintech_api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.config.SecurityConfig;
import com.fintechapp.fintech_api.security.JsonAuthenticationEntryPoint;
import com.fintechapp.fintech_api.security.JwtAuthenticationFilter;
import com.fintechapp.fintech_api.security.JwtService;
import com.fintechapp.fintech_api.service.AuthService;
import com.fintechapp.fintech_api.service.UserService;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JwtService.class})
@ImportAutoConfiguration({ServletWebSecurityAutoConfiguration.class, SecurityFilterAutoConfiguration.class})
@TestPropertySource(properties = "app.jwt.secret-key=test-secret-key-test-secret-key-1234567890")
class AuthControllerSecurityTest {

	private static final String SECRET = "test-secret-key-test-secret-key-1234567890";

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private AuthService authService;

	@MockitoBean
	private UserService userService;

	@Test
	void returnsUnauthorizedWhenTokenIsMissing() throws Exception {
		mockMvc.perform(get("/api/auth/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("No token provided."));
	}

	@Test
	void returnsUnauthorizedWhenTokenFormatIsInvalid() throws Exception {
		mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Basic not-a-bearer-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("Invalid token format."));
	}

	@Test
	void returnsUnauthorizedWhenTokenIsInvalid() throws Exception {
		mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer not-a-valid-jwt"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("Invalid token."));
	}

	@Test
	void returnsUnauthorizedWhenTokenHasExpired() throws Exception {
		String expiredToken = createToken(
				"user-123",
				"user@example.com",
				Instant.now().minusSeconds(3600),
				Instant.now().minusSeconds(60)
		);

		mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer " + expiredToken))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("Token has expired."));
	}

	@Test
	void returnsUnauthorizedWhenTokenPayloadIsInvalid() throws Exception {
		String invalidPayloadToken = createPayloadOnlyToken("{\"email\":\"user@example.com\",\"iat\":1700000000,\"exp\":4700000000}");

		mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer " + invalidPayloadToken))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("Invalid token payload."));
	}

	@Test
	void returnsAuthenticatedUserWhenTokenIsValid() throws Exception {
		when(userService.getCurrentUser(any())).thenReturn(new UserDataResponse(
				true,
				"Current user fetched successfully.",
				new UserSummaryResponse(
						"user-123",
						"James",
						"user@example.com",
						null,
						"USD",
						0.0,
						0.0,
						Instant.ofEpochSecond(1_700_000_000L),
						Instant.ofEpochSecond(1_700_003_600L)
				)
		));

		String validToken = createToken(
				"user-123",
				"user@example.com",
				Instant.now().minusSeconds(60),
				Instant.now().plusSeconds(3600)
		);

		mockMvc.perform(get("/api/auth/me")
						.header("Authorization", "Bearer " + validToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.id").value("user-123"))
				.andExpect(jsonPath("$.data.email").value("user@example.com"))
				.andExpect(jsonPath("$.data.username").value("James"));
	}

	private String createToken(String userId, String email, Instant issuedAt, Instant expiresAt) throws GeneralSecurityException {
		String payload = String.format(
				"{\"userId\":\"%s\",\"email\":\"%s\",\"iat\":%d,\"exp\":%d}",
				userId,
				email,
				issuedAt.getEpochSecond(),
				expiresAt.getEpochSecond()
		);
		return createPayloadOnlyToken(payload);
	}

	private String createPayloadOnlyToken(String payloadJson) throws GeneralSecurityException {
		String header = base64UrlEncode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
		String payload = base64UrlEncode(payloadJson);
		String signature = sign(header + "." + payload);
		return header + "." + payload + "." + signature;
	}

	private String sign(String value) throws GeneralSecurityException {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
	}

	private String base64UrlEncode(String value) {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
	}
}


