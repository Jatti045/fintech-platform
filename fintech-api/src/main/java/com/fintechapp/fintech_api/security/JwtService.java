package com.fintechapp.fintech_api.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class JwtService {

	private static final Logger logger = LoggerFactory.getLogger(JwtService.class);

	@Value("${app.jwt.secret-key:}")
	private String secretKey;

	public String generateToken(String userId, String email) {
		if (!StringUtils.hasText(secretKey)) {
			logger.error("JWT_SECRET_KEY is not defined in environment variables");
			throw new TokenAuthenticationException(HttpStatus.INTERNAL_SERVER_ERROR, "Server configuration error.");
		}

		if (!StringUtils.hasText(userId) || !StringUtils.hasText(email)) {
			throw new TokenAuthenticationException(HttpStatus.BAD_REQUEST, "Invalid token payload.");
		}

		try {
			long issuedAt = Instant.now().getEpochSecond();

			String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
			String payloadJson = String.format(
					Locale.ROOT,
					"{\"userId\":\"%s\",\"email\":\"%s\",\"iat\":%d}",
					escapeJsonString(userId),
					escapeJsonString(email),
					issuedAt);

			String encodedHeader = Base64.getUrlEncoder().withoutPadding()
					.encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));
			String encodedPayload = Base64.getUrlEncoder().withoutPadding()
					.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
			String signature = sign(encodedHeader + "." + encodedPayload);
			return encodedHeader + "." + encodedPayload + "." + signature;
		} catch (GeneralSecurityException exception) {
			throw new TokenAuthenticationException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate token.",
					exception);
		}
	}

	public AuthenticatedUser authenticate(String token) {
		if (!StringUtils.hasText(secretKey)) {
			logger.error("JWT_SECRET_KEY is not defined in environment variables");
			throw new TokenAuthenticationException(HttpStatus.INTERNAL_SERVER_ERROR, "Server configuration error.");
		}

		try {
			String[] tokenParts = token.split("\\.");
			if (tokenParts.length != 3) {
				throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token.");
			}

			String headerJson = decodeBase64Url(tokenParts[0]);
			if (!"HS256".equals(extractStringClaim(headerJson, "alg"))) {
				throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token.");
			}

			validateSignature(tokenParts[0], tokenParts[1], tokenParts[2]);

			String payloadJson = decodeBase64Url(tokenParts[1]);
			String userId = extractStringClaim(payloadJson, "userId");
			String email = extractStringClaim(payloadJson, "email");
			Long issuedAt = extractLongClaim(payloadJson, "iat");

			if (!StringUtils.hasText(userId) || !StringUtils.hasText(email) || issuedAt == null) {
				throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token payload.");
			}

			return new AuthenticatedUser(userId, email, issuedAt);
		} catch (IllegalArgumentException | GeneralSecurityException exception) {
			throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token.", exception);
		}
	}

	private void validateSignature(String encodedHeader, String encodedPayload, String encodedSignature)
			throws GeneralSecurityException {
		byte[] expectedSignature = signRaw(encodedHeader + "." + encodedPayload);
		byte[] actualSignature = Base64.getUrlDecoder().decode(addRequiredPadding(encodedSignature));

		if (!MessageDigest.isEqual(expectedSignature, actualSignature)) {
			throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token.");
		}
	}

	private String sign(String value) throws GeneralSecurityException {
		return Base64.getUrlEncoder().withoutPadding().encodeToString(signRaw(value));
	}

	private byte[] signRaw(String value) throws GeneralSecurityException {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
	}

	private String escapeJsonString(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("\"", "\\\"")
				.replace("\b", "\\b")
				.replace("\f", "\\f")
				.replace("\n", "\\n")
				.replace("\r", "\\r")
				.replace("\t", "\\t");
	}

	private String decodeBase64Url(String value) {
		byte[] decodedBytes = Base64.getUrlDecoder().decode(addRequiredPadding(value));
		return new String(decodedBytes, StandardCharsets.UTF_8);
	}

	private String addRequiredPadding(String value) {
		int requiredPadding = (4 - (value.length() % 4)) % 4;
		return value + "=".repeat(requiredPadding);
	}

	private String extractStringClaim(String json, String claimName) {
		Matcher matcher = Pattern
				.compile("\\\"" + Pattern.quote(claimName) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"")
				.matcher(json);
		if (!matcher.find()) {
			return null;
		}

		return unescapeJsonString(matcher.group(1));
	}

	private Long extractLongClaim(String json, String claimName) {
		Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(claimName) + "\\\"\\s*:\\s*(-?\\d+)")
				.matcher(json);
		if (!matcher.find()) {
			return null;
		}

		return Long.parseLong(matcher.group(1));
	}

	private String unescapeJsonString(String value) {
		return value
				.replace("\\\"", "\"")
				.replace("\\\\", "\\")
				.replace("\\/", "/")
				.replace("\\b", "\b")
				.replace("\\f", "\f")
				.replace("\\n", "\n")
				.replace("\\r", "\r")
				.replace("\\t", "\t");
	}
}
