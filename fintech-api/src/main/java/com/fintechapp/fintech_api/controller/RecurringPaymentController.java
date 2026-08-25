package com.fintechapp.fintech_api.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse;
import com.fintechapp.fintech_api.service.RecurringPaymentService;

/**
 * Exposes detected recurring payments ("upcoming bills") derived from the
 * authenticated user's expense history. Read-only and computed on demand —
 * there is no recurring-payments table; predictions are always fresh from the
 * transactions that back them.
 */
@RestController
@RequestMapping("/api/recurring-payments")
public class RecurringPaymentController {

    private final RecurringPaymentService recurringPaymentService;

    public RecurringPaymentController(RecurringPaymentService recurringPaymentService) {
        this.recurringPaymentService = recurringPaymentService;
    }

    @GetMapping
    public RecurringPaymentsResponse getRecurringPayments(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return new RecurringPaymentsResponse(
                true,
                "Recurring payments retrieved successfully",
                recurringPaymentService.detectForAuthenticatedUser(authenticatedUser));
    }
}