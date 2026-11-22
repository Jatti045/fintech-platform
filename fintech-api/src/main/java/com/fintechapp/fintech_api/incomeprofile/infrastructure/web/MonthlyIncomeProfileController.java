package com.fintechapp.fintech_api.incomeprofile.infrastructure.web;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.dto.user.UserSummaryResponse;
import com.fintechapp.fintech_api.incomeprofile.application.GetMonthlyIncomeProfile;
import com.fintechapp.fintech_api.incomeprofile.domain.IncomeMonth;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class MonthlyIncomeProfileController {
  private final GetMonthlyIncomeProfile operation;

  public MonthlyIncomeProfileController(GetMonthlyIncomeProfile operation) {
    this.operation = operation;
  }

  @GetMapping("/api/users/me/monthly-income")
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public UserDataResponse read(
      @AuthenticationPrincipal AuthenticatedUser actor,
      @RequestParam String month,
      @RequestParam String year) {
    if (actor == null || !StringUtils.hasText(actor.userId())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }
    try {
      var result = operation.execute(actor.userId(), month, year);
      var profile = result.profile();
      return new UserDataResponse(
          true,
          "Monthly income fetched successfully.",
          new UserSummaryResponse(
              profile.id(),
              profile.username(),
              profile.email(),
              profile.profilePic(),
              profile.currency(),
              profile.setupComplete(),
              result.expectedIncome(),
              result.actualIncome(),
              profile.createdAt(),
              profile.updatedAt()));
    } catch (GetMonthlyIncomeProfile.ProfileNotFound e) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
    } catch (IncomeMonth.InvalidPeriod e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
    }
  }
}
