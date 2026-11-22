package com.fintechapp.fintech_api.accountsetup.infrastructure.web;

import com.fintechapp.fintech_api.accountsetup.application.CompleteAccountSetup;
import com.fintechapp.fintech_api.accountsetup.domain.SetupSettings;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.CompleteSetupRequest;
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
public class AccountSetupController {
  private final CompleteAccountSetup operation;

  public AccountSetupController(CompleteAccountSetup operation) {
    this.operation = operation;
  }

  @PatchMapping("/api/users/me/setup")
  @Transactional
  public UserDataResponse completeSetup(
      @AuthenticationPrincipal AuthenticatedUser actor,
      @Valid @RequestBody CompleteSetupRequest request) {
    if (actor == null || !StringUtils.hasText(actor.userId())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }
    try {
      var profile = operation.execute(actor.userId(), request.monthlyIncome(), request.currency());
      return new UserDataResponse(
          true,
          "Account setup is complete.",
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
    } catch (CompleteAccountSetup.AccountNotFound exception) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
    } catch (SetupSettings.InvalidIncome exception) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Monthly income must be a non-negative number.");
    } catch (SetupSettings.InvalidCurrency exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid currency code");
    } catch (CompleteAccountSetup.CurrencyChangeBlocked exception) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Cannot change currency after financial data exists (transactions, budgets, or monthly"
              + " income).");
    }
  }
}
