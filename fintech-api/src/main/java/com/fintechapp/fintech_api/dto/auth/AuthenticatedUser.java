package com.fintechapp.fintech_api.dto.auth;

public record AuthenticatedUser(
		String userId,
		String email,
		long iat,
        long sessionVersion
) {
    public AuthenticatedUser(String userId, String email, long iat) {
        this(userId, email, iat, 0);
    }
}

