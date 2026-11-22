package com.fintechapp.fintech_api.recurring.infrastructure.web;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse;
import com.fintechapp.fintech_api.recurring.infrastructure.cache.CachedRecurringPayments;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes detected recurring payments ("upcoming bills") derived from the authenticated user's
 * expense history. Read-only and computed on demand — there is no recurring-payments table;
 * predictions are always fresh from the transactions that back them.
 */
@RestController
@RequestMapping("/api/recurring-payments")
public class RecurringPaymentController {

  private final CachedRecurringPayments recurringPayments;

  public RecurringPaymentController(CachedRecurringPayments recurringPayments) {
    this.recurringPayments = recurringPayments;
  }

  @GetMapping
  public RecurringPaymentsResponse getRecurringPayments(
      @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
    return new RecurringPaymentsResponse(
        true,
        "Recurring payments retrieved successfully",
        recurringPayments.read(authenticatedUser == null ? null : authenticatedUser.userId()));
  }
}
