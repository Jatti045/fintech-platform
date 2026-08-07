package com.fintechapp.fintech_api.dto.auth;

public record AuthenticatedUser(
		String userId,
		String email,
		long iat
) {
}

