package com.fintechapp.fintech_api.dto.budget;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload for {@code POST /api/budgets/apply-suggestions}.
 *
 * <p>Each item is the user's deliberate choice: a category learned from the
 * suggestions endpoint (or a new one), plus an explicit limit. The server
 * applies the batch atomically and never writes a value the user did not
 * confirm.</p>
 */
public record ApplySuggestionsRequest(
                @NotNull(message = "Month is required")
                @Min(value = 0, message = "Month must be between 0 and 11")
                @Max(value = 11, message = "Month must be between 0 and 11") Integer month,

                @NotNull(message = "Year is required")
                @Min(value = 1970, message = "Year is invalid")
                @Max(value = 2100, message = "Year is invalid") Integer year,

                @NotNull(message = "Items are required")
                @NotEmpty(message = "At least one budget is required")
                @Valid List<Item> items) {

        public record Item(
                        @NotBlank(message = "Category is required")
                        @Size(max = 64, message = "Category is too long") String category,

                        @NotNull(message = "Limit is required")
                        @Min(value = 0, message = "Limit must be a non-negative number")
                        Double limit) {
        }
}