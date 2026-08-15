package com.fintechapp.fintech_api.security;

import java.io.IOException;
import java.util.Set;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	public static final String AUTHENTICATED_USER_ATTRIBUTE = "authenticatedUser";
	private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
	private static final String BEARER_PREFIX = "Bearer ";
	private static final Set<String> PUBLIC_PATHS = Set.of(
			"/error",
			"/api/health",
			"/api/auth/login",
			"/api/auth/register",
			"/api/auth/signup",
			"/api/auth/forgot-password",
			"/api/auth/reset-password",
			"/api/auth/google",
			"/api/plaid/webhook"
	);

	private final JwtService jwtService;
	private final JsonAuthenticationEntryPoint authenticationEntryPoint;

	public JwtAuthenticationFilter(JwtService jwtService, JsonAuthenticationEntryPoint authenticationEntryPoint) {
		this.jwtService = jwtService;
		this.authenticationEntryPoint = authenticationEntryPoint;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		// Always skip OPTIONS preflight requests (CORS)
		if (HttpMethod.OPTIONS.matches(request.getMethod())) {
			return true;
		}
		// Use the full request URI rather than getServletPath(), which can be
		// empty in embedded/test contexts and would cause API paths to be
		// misclassified as non-API (and therefore skipped).
		String requestPath = request.getRequestURI();
		return !requestPath.startsWith("/api/") || PUBLIC_PATHS.contains(stripTrailingSlash(requestPath));
	}

	/**
	 * Normalizes a request path so a trailing slash does not turn a public
	 * endpoint (e.g. /api/plaid/webhook/) into a protected one.
	 */
	private static String stripTrailingSlash(String path) {
		if (path == null || path.isEmpty()) {
			return "";
		}
		int end = path.length();
		while (end > 1 && path.charAt(end - 1) == '/') {
			end--;
		}
		return path.substring(0, end);
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		logger.info("Authenticating user...");

		String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (!StringUtils.hasText(authHeader)) {
			authenticationEntryPoint.writeResponse(response, HttpStatus.UNAUTHORIZED, "No token provided.");
			return;
		}

		if (!authHeader.startsWith(BEARER_PREFIX)) {
			authenticationEntryPoint.writeResponse(response, HttpStatus.UNAUTHORIZED, "Invalid token format.");
			return;
		}

		String token = authHeader.substring(BEARER_PREFIX.length()).trim();
		if (!StringUtils.hasText(token)) {
			authenticationEntryPoint.writeResponse(response, HttpStatus.UNAUTHORIZED, "Invalid token format.");
			return;
		}

		try {
			AuthenticatedUser authenticatedUser = jwtService.authenticate(token);
			logger.info("Token verified successfully for user {}", authenticatedUser.email());

			UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
					authenticatedUser,
					null,
					Set.of()
			);
			authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
			SecurityContextHolder.getContext().setAuthentication(authentication);

			request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, authenticatedUser);

			logger.info("User authenticated successfully: {}", authenticatedUser.email());
			filterChain.doFilter(request, response);
		} catch (TokenAuthenticationException exception) {
			logger.error("Authentication error", exception);
			SecurityContextHolder.clearContext();
			authenticationEntryPoint.writeResponse(response, exception.getStatus(), exception.getMessage());
		} catch (AuthenticationException exception) {
			SecurityContextHolder.clearContext();
			authenticationEntryPoint.writeResponse(response, HttpStatus.UNAUTHORIZED, exception.getMessage());
		}
	}
}





