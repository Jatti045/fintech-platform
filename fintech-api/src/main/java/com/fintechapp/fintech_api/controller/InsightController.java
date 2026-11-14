package com.fintechapp.fintech_api.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.insight.MonthlyInsightResponse;
import com.fintechapp.fintech_api.service.MonthlyInsightService;

@RestController
@RequestMapping("/api/insights")
public class InsightController {
    private final MonthlyInsightService insights;

    public InsightController(MonthlyInsightService insights) {
        this.insights = insights;
    }

    @PostMapping("/monthly")
    public ResponseEntity<MonthlyInsightResponse> generate(
            @AuthenticationPrincipal AuthenticatedUser auth, @RequestBody JsonNode period) {
        return generate(auth, integer(period.path("year")), integer(period.path("month")));
    }

    /** Compatibility for installed clients that already send an explicit period. */
    @Deprecated
    @GetMapping("/monthly")
    public ResponseEntity<MonthlyInsightResponse> legacyGenerate(
            @AuthenticationPrincipal AuthenticatedUser auth, @RequestParam int month, @RequestParam int year) {
        return generate(auth, year, month);
    }

    private static int integer(JsonNode value) {
        if (!value.isIntegralNumber() || !value.canConvertToInt()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Integer month and year are required");
        }
        return value.asInt();
    }

    private ResponseEntity<MonthlyInsightResponse> generate(AuthenticatedUser auth, int year, int month) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(insights.generateForAuthenticatedUser(auth, year, month));
    }
}
