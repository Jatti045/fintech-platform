package com.fintechapp.fintech_api.config;

import java.util.List;
import java.util.Arrays;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.fintechapp.fintech_api.security.JwtAuthenticationFilter;
import com.fintechapp.fintech_api.security.JsonAuthenticationEntryPoint;

@Configuration
public class SecurityConfig {

	@Value("${app.security.allowed-origins:http://localhost:8081,http://localhost:19006}")
	private String allowedOrigins;

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration config = new CorsConfiguration();
		List<String> resolvedOrigins = Arrays.stream(allowedOrigins.split(","))
				.map(String::trim)
				.filter(origin -> !origin.isEmpty())
				.toList();
		config.setAllowedOrigins(resolvedOrigins);
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
		config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
		config.setExposedHeaders(List.of("Authorization"));
		config.setAllowCredentials(false);
		config.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			JwtAuthenticationFilter jwtAuthenticationFilter,
			JsonAuthenticationEntryPoint authenticationEntryPoint,
			CorsConfigurationSource corsConfigurationSource) throws Exception {
		http
				.cors(cors -> cors.configurationSource(corsConfigurationSource))
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(
						(request, response, authException) -> authenticationEntryPoint.writeResponse(
								response,
								HttpStatus.UNAUTHORIZED,
								"No token provided.")))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(
								"/error",
								"/api/health",
								"/api/auth/login",
								"/api/auth/register",
								"/api/auth/signup",
								"/api/auth/google",
								"/api/auth/forgot-password",
								"/api/auth/reset-password",
								"/api/plaid/webhook")
						.permitAll()
						.requestMatchers("/api/**").authenticated()
						.anyRequest().permitAll())
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}
}
