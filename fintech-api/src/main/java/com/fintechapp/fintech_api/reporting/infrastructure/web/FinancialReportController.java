package com.fintechapp.fintech_api.reporting.infrastructure.web;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse;
import com.fintechapp.fintech_api.service.FinancialReportService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/financial-summary")
public class FinancialReportController {
  private final FinancialReportService reports;

  public FinancialReportController(FinancialReportService reports) {
    this.reports = reports;
  }

  @GetMapping("/report")
  public FinancialReportResponse getReport(
      @AuthenticationPrincipal AuthenticatedUser auth,
      @RequestParam(required = false) String month,
      @RequestParam(required = false) String year) {
    Integer m = parseInteger(month), y = parseInteger(year);
    if (m == null || y == null || m < 0 || m > 11 || y < 1 || y > 9998) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Valid month and year are required");
    }
    return new FinancialReportResponse(true, "Monthly report loaded", reports.report(auth, y, m));
  }

  private Integer parseInteger(String raw) {
    if (!StringUtils.hasText(raw)) {
      return null;
    }

    try {
      return Integer.parseInt(raw.trim());
    } catch (NumberFormatException ignored) {
      return null;
    }
  }
}
