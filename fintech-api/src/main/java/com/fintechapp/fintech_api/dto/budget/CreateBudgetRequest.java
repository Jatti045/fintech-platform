package com.fintechapp.fintech_api.dto.budget;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateBudgetRequest(
                @NotBlank(message = "Category is required") @Size(max = 64, message = "Category is too long") String category,

                @NotNull(message = "Limit is required") @DecimalMin(value = "0.01", inclusive = true, message = "Limit must be greater than 0") Double limit,

                @NotNull(message = "Month is required") @Min(value = 0, message = "Month must be between 0 and 11") @Max(value = 11, message = "Month must be between 0 and 11") Integer month,

                @NotNull(message = "Year is required") @Min(value = 1970, message = "Year is invalid") @Max(value = 2100, message = "Year is invalid") Integer year) {
}
