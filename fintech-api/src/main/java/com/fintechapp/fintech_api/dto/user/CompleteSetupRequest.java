package com.fintechapp.fintech_api.dto.user;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record CompleteSetupRequest(
    @NotNull(message = "Monthly income is required")
        @DecimalMin(value = "0", message = "Monthly income cannot be negative")
        BigDecimal monthlyIncome,
    @NotNull(message = "Currency is required")
        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO code")
        String currency) {}
