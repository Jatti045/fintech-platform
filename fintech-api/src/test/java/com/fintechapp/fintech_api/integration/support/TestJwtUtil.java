package com.fintechapp.fintech_api.integration.support;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.security.JwtService;

@Component
public class TestJwtUtil {

    private final JwtService jwtService;

    public TestJwtUtil(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public String tokenFor(User user) {
        return jwtService.generateToken(user.getId(), user.getEmail(), user.getSessionVersion());
    }

    public String bearerHeaderValue(User user) {
        return "Bearer " + tokenFor(user);
    }

    public String authHeaderName() {
        return HttpHeaders.AUTHORIZATION;
    }

    // TODO: Security currently does not enforce role claims; verify and extend when RBAC is introduced.
    public String tokenForRole(User user, String role) {
        return tokenFor(user);
    }
}

