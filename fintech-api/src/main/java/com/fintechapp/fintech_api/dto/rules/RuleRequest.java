package com.fintechapp.fintech_api.dto.rules;
import jakarta.validation.constraints.*;
public record RuleRequest(@NotBlank @Size(max=80) String title, @NotBlank String field,
        @NotBlank String matchMode, @NotBlank @Size(max=120) String matchText,
        String direction, @Size(max=128) String accountId, @Size(max=64) String providerCategoryCondition,
        @Size(max=64) String category, @Size(max=64) String budgetCategory,
        @Size(max=120) String displayName, @Min(0) @Max(10000) int priority, boolean enabled, Long revision) {}
