package com.fintechapp.fintech_api.dto.transaction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTransactionRequest(
        @NotBlank(message = "Transaction name is required") @Size(max = 120, message = "Transaction name is too long") String name,

        @Min(value = 0, message = "Month must be between 0 and 11") @Max(value = 11, message = "Month must be between 0 and 11") Integer month,

        @Min(value = 1970, message = "Year is invalid") @Max(value = 2100, message = "Year is invalid") Integer year,

        @NotBlank(message = "Date is required") String date,

        @NotBlank(message = "Category is required") @Size(max = 64, message = "Category is too long") String category,

        @NotBlank(message = "Type is required") @Pattern(regexp = "^(?i)(INCOME|EXPENSE)$", message = "Type must be INCOME or EXPENSE") String type,

        @NotNull(message = "Amount is required") @DecimalMin(value = "0.01", inclusive = true, message = "Amount must be greater than 0") Double amount,

        @Size(max = 1000, message = "Description is too long") String description,

        String budgetId,
        String goalId,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Base currency must be a 3-letter ISO code") String baseCurrency,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Original currency must be a 3-letter ISO code") String originalCurrency,

        @DecimalMin(value = "0.01", inclusive = true, message = "Original amount must be greater than 0") Double originalAmount) {
}
