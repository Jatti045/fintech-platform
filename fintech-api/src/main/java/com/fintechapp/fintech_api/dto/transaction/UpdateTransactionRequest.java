package com.fintechapp.fintech_api.dto.transaction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateTransactionRequest(
        @Size(max = 120, message = "Transaction name is too long") String name,
        String date,

        @Size(max = 64, message = "Category is too long") String category,

        @Pattern(regexp = "^(?i)(INCOME|EXPENSE)$", message = "Type must be INCOME or EXPENSE") String type,

        @DecimalMin(value = "0.01", inclusive = true, message = "Amount must be greater than 0") Double amount,

        @Size(max = 1000, message = "Description is too long") String description,
        String budgetId,
        String goalId,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Base currency must be a 3-letter ISO code") String baseCurrency,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Original currency must be a 3-letter ISO code") String originalCurrency,

        @DecimalMin(value = "0.01", inclusive = true, message = "Original amount must be greater than 0") Double originalAmount) {
}
