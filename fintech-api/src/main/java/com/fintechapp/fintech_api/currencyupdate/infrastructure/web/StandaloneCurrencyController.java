package com.fintechapp.fintech_api.currencyupdate.infrastructure.web;

import com.fintechapp.fintech_api.currencyupdate.application.ChangeAccountCurrency;
import com.fintechapp.fintech_api.currencyupdate.domain.RequestedCurrency;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.UpdateCurrencyRequest;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class StandaloneCurrencyController {
  private final ChangeAccountCurrency operation;

  public StandaloneCurrencyController(ChangeAccountCurrency operation) {
    this.operation = operation;
  }

  @PatchMapping("/api/users/me/currency")
  @Transactional
  public UserDataResponse updateCurrency(
      @AuthenticationPrincipal AuthenticatedUser actor,
      @Valid @RequestBody UpdateCurrencyRequest request) {
    if (actor == null || !StringUtils.hasText(actor.userId())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }
    try {
      var profile = operation.execute(actor.userId(), request == null ? null : request.currency());
      return new UserDataResponse(
          true,
          "Currency updated successfully.",
          new UserSummaryResponse(
              profile.id(),
              profile.username(),
              profile.email(),
              profile.profilePic(),
              profile.currency(),
              profile.setupComplete(),
              profile.expectedIncome(),
              profile.actualIncome(),
              profile.createdAt(),
              profile.updatedAt()));
    } catch (ChangeAccountCurrency.AccountNotFound exception) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
    } catch (RequestedCurrency.MissingCode exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency code is required.");
    } catch (RequestedCurrency.InvalidCode exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency code");
    } catch (ChangeAccountCurrency.FinancialDataExists exception) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Cannot change currency after financial data exists (transactions, budgets, or monthly"
              + " income).");
    }
  }
}
