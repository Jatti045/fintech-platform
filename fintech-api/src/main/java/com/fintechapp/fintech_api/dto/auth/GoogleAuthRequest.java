package com.fintechapp.fintech_api.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record GoogleAuthRequest(
        @NotBlank @Size(max = 16384) String idToken,
        @Pattern(regexp = "[0-9]{6}") String verificationCode) {
    public GoogleAuthRequest(String idToken) { this(idToken, null); }
}
