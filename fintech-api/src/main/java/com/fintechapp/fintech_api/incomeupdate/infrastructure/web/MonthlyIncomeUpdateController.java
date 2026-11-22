package com.fintechapp.fintech_api.incomeupdate.infrastructure.web;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.UpdateMonthlyIncomeRequest;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.incomeupdate.application.UpdateIncomeBaseline;
import com.fintechapp.fintech_api.incomeupdate.domain.IncomeBaselineChange;
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
public class MonthlyIncomeUpdateController {
  private final UpdateIncomeBaseline operation;

  public MonthlyIncomeUpdateController(UpdateIncomeBaseline operation) {
    this.operation = operation;
  }

  @PatchMapping("/api/users/me/monthly-income")
  @Transactional
  public UserDataResponse update(
      @AuthenticationPrincipal AuthenticatedUser actor,
      @Valid @RequestBody UpdateMonthlyIncomeRequest request) {
    if (actor == null || !StringUtils.hasText(actor.userId())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }
    try {
      var profile =
          operation.execute(
              actor.userId(), request.monthlyIncome(), request.month(), request.year());
      return new UserDataResponse(
          true,
          "Monthly income updated successfully.",
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
    } catch (UpdateIncomeBaseline.OwnerNotFound exception) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
    } catch (IncomeBaselineChange.MissingAmount exception) {
      throw badRequest("Monthly income is required.");
    } catch (IncomeBaselineChange.NonfiniteAmount exception) {
      throw badRequest("Monthly income must be finite.");
    } catch (IncomeBaselineChange.NegativeAmount exception) {
      throw badRequest("Monthly income must be a non-negative number.");
    } catch (IncomeBaselineChange.MissingPeriod exception) {
      throw badRequest("Month and year are required");
    } catch (IncomeBaselineChange.InvalidPeriod exception) {
      throw badRequest("Invalid month/year value");
    }
  }

  private static ResponseStatusException badRequest(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
