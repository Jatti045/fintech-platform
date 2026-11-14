package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.ai.AiClientException;
import com.fintechapp.fintech_api.ai.AiCompletionClient;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialReportResponse.*;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.dto.insight.MonthlyInsightResponse;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * Unit tests for the monthly AI insight: deterministic context assembly from
 * the existing financial services, the insufficient-data short-circuit, and
 * graceful handling of provider failures and malformed model output. The AI
 * provider is always mocked — no real API calls.
 */
class MonthlyInsightServiceTest {

    private static final AuthenticatedUser AUTH =
            new AuthenticatedUser("user-1", "user@example.com", 0L);

    private AiCompletionClient aiClient;
    private FinancialReportService reports;
    private UserRepository userRepository;
    private User user;

    private MonthlyInsightService service;

    @BeforeEach
    void setUp() {
        aiClient = mock(AiCompletionClient.class);
        reports = mock(FinancialReportService.class);
        userRepository = mock(UserRepository.class);

        user = mock(User.class);
        when(user.getId()).thenReturn("user-1");
        when(user.getCurrency()).thenReturn("EUR");
        when(user.getEmail()).thenReturn("user@example.com");
        when(userRepository.findByIdForUpdate("user-1")).thenReturn(java.util.Optional.of(user));
        when(user.isAiProcessingEnabled()).thenReturn(true);
        when(user.getAiConsentVersion()).thenReturn("1");

        service = new MonthlyInsightService(aiClient, reports, userRepository);
    }

    private void stubFinancialMonth(int month, double expenses) {
        var summary = new FinancialSummaryData(expenses, 4200, 4000, 4200, expenses, 4200 - expenses, 50);
        var report = new Report(2026, month, "EUR", null, "ACTUAL", true, 3, summary, expenses, 0,
                List.of(), List.of(new Category("restaurants", 320, 0, 320), new Category("groceries", 460, 0, 460)),
                List.of(new BudgetUsage("id", "Entertainment", 1000, 910, 90, 91.0, false, "user-1", null, null, null)),
                null);
        when(reports.facts(user, 2026, month)).thenReturn(new FinancialReportService.MonthlyFacts(report,
                List.of(new Category("restaurants", 300, 0, 300))));
        when(aiClient.complete(anyString(), anyString())).thenReturn(
                "{\"summary\":\"Spending is up.\",\"highlights\":[\"Restaurants +32%\"]}");
    }

    @Test
    void disabledOrOutdatedConsentPreventsEveryProviderCall() {
        when(user.isAiProcessingEnabled()).thenReturn(false);
        ResponseStatusException disabled = org.junit.jupiter.api.Assertions.assertThrows(ResponseStatusException.class,
                () -> service.generateForAuthenticatedUser(AUTH, 2026, 8));
        assertEquals(HttpStatus.FORBIDDEN, disabled.getStatusCode());
        when(user.isAiProcessingEnabled()).thenReturn(true);
        when(user.getAiConsentVersion()).thenReturn("outdated");
        org.junit.jupiter.api.Assertions.assertThrows(ResponseStatusException.class,
                () -> service.generateForAuthenticatedUser(AUTH, 2026, 8));
        verify(aiClient, never()).complete(anyString(), anyString());
        verify(reports, never()).facts(any(), anyInt(), anyInt());
    }

    private ResponseStatusException generateExpectingFailure() {
        return org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> service.generateForAuthenticatedUser(AUTH, 2026, 8));
    }

    @Test
    void returnsDeterministicResponseWithoutCallingAiWhenMonthIsEmpty() {
        var report = new Report(2026, 8, "EUR", null, "UNCONFIGURED", false, 0,
                new FinancialSummaryData(0, 0, 0, 0, 0, 0, 0), 0, 0,
                List.of(), List.of(), List.of(), null);
        when(reports.facts(user, 2026, 8)).thenReturn(new FinancialReportService.MonthlyFacts(report, List.of()));

        MonthlyInsightResponse response = service.generateForAuthenticatedUser(AUTH, 2026, 8);

        assertTrue(response.data().insufficientData());
        assertEquals(MonthlyInsightService.INSUFFICIENT_DATA_SUMMARY, response.data().summary());
        assertEquals("EUR", response.data().currency());
        verify(aiClient, never()).complete(anyString(), anyString());
    }

    @Test
    void sendsOnlyStructuredFinancialFactsToTheProvider() {
        stubFinancialMonth(8, 3750);

        service.generateForAuthenticatedUser(AUTH, 2026, 8);

        ArgumentCaptor<String> userContent = ArgumentCaptor.forClass(String.class);
        verify(aiClient).complete(anyString(), userContent.capture());

        String json = userContent.getValue();
        // Deterministic facts are present...
        assertTrue(json.contains("\"income\":4200.0"));
        assertTrue(json.contains("\"expenses\":3750.0"));
        assertTrue(json.contains("\"net\":450.0"));
        assertTrue(json.contains("\"currency\":\"EUR\""));
        assertTrue(json.contains("Entertainment"));
        assertTrue(!json.contains("recurringChanges"));
        // ...and raw identifiers / transaction dumps / credentials are not.
        assertTrue(!json.contains("user-1"));
        assertTrue(!json.contains("transactions"));
        assertTrue(!json.contains("apiKey"));
    }

    /**
     * Regression: the AI context must carry the human-readable 1-based month
     * matching the selected month. Fundleaf's API month is 0-based, and the
     * context previously serialized the raw index — so a user viewing
     * September 2026 (index 8) got an AI summary about "August".
     */
    @Test
    void aiContextUsesHumanReadableMonthMatchingTheSelectedMonth() {
        stubFinancialMonth(8, 3750); // zero-based 8 = September

        service.generateForAuthenticatedUser(AUTH, 2026, 8);

        ArgumentCaptor<String> userContent = ArgumentCaptor.forClass(String.class);
        verify(aiClient).complete(anyString(), userContent.capture());

        String json = userContent.getValue();
        assertTrue(json.contains("\"monthName\":\"September\""));
        assertTrue(json.contains("\"month\":9"));
        assertTrue(!json.contains("\"month\":8"));
    }

    @Test
    void januaryMapsToHumanReadableJanuaryInAiContext() {
        stubFinancialMonth(0, 3750); // zero-based 0 = January

        service.generateForAuthenticatedUser(AUTH, 2026, 0);

        ArgumentCaptor<String> userContent = ArgumentCaptor.forClass(String.class);
        verify(aiClient).complete(anyString(), userContent.capture());

        String json = userContent.getValue();
        assertTrue(json.contains("\"monthName\":\"January\""));
        assertTrue(json.contains("\"month\":1"));
    }

    @Test
    void decemberMapsToHumanReadableDecemberInAiContext() {
        stubFinancialMonth(11, 3750); // zero-based 11 = December

        service.generateForAuthenticatedUser(AUTH, 2026, 11);

        ArgumentCaptor<String> userContent = ArgumentCaptor.forClass(String.class);
        verify(aiClient).complete(anyString(), userContent.capture());

        String json = userContent.getValue();
        assertTrue(json.contains("\"monthName\":\"December\""));
        assertTrue(json.contains("\"month\":12"));
    }

    @Test
    void navigatingFromAugustToSeptemberMovesTheAiContextToSeptember() {
        stubFinancialMonth(7, 3750); // user views August first
        service.generateForAuthenticatedUser(AUTH, 2026, 7);

        stubFinancialMonth(8, 3750); // user navigates to September
        service.generateForAuthenticatedUser(AUTH, 2026, 8);

        ArgumentCaptor<String> userContent = ArgumentCaptor.forClass(String.class);
        verify(aiClient, org.mockito.Mockito.times(2)).complete(anyString(), userContent.capture());

        List<String> payloads = userContent.getAllValues();
        assertTrue(payloads.get(0).contains("\"monthName\":\"August\""));
        assertTrue(payloads.get(1).contains("\"monthName\":\"September\""));
        assertTrue(!payloads.get(1).contains("\"monthName\":\"August\""));
    }

    @Test
    void returnsGeneratedExplanationForTheRequestedMonth() {
        stubFinancialMonth(8, 3750);

        MonthlyInsightResponse response = service.generateForAuthenticatedUser(AUTH, 2026, 8);

        assertEquals(false, response.data().insufficientData());
        assertEquals("Spending is up.", response.data().summary());
        assertEquals(List.of("Restaurants +32%"), response.data().highlights());
        assertEquals(2026, response.data().year());
        assertEquals(8, response.data().month());
        verify(reports).facts(user, 2026, 8);
    }

    @Test
    void mapsProviderFailureToServiceUnavailableWithoutRawDetails() {
        stubFinancialMonth(8, 3750);
        when(aiClient.complete(anyString(), anyString()))
                .thenThrow(new AiClientException(
                        AiClientException.Kind.PROVIDER_FAILURE, "boom"));

        ResponseStatusException exception = generateExpectingFailure();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        assertEquals(MonthlyInsightService.GENERATION_FAILED_MESSAGE, exception.getReason());
    }

    @Test
    void mapsMalformedAiOutputToServiceUnavailable() {
        stubFinancialMonth(8, 3750);
        when(aiClient.complete(anyString(), anyString())).thenReturn("not json at all");

        ResponseStatusException exception = generateExpectingFailure();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    @Test
    void rejectsAiOutputMissingTheSummaryField() {
        stubFinancialMonth(8, 3750);
        when(aiClient.complete(anyString(), anyString()))
                .thenReturn("{\"highlights\":[\"only bullets\"]}");

        ResponseStatusException exception = generateExpectingFailure();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    @Test
    void stripsCodeFencesAndCapsHighlightsWhenParsing() {
        String raw = "```json\n{\"summary\":\"ok\","
                + "\"highlights\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\"]}\n```";
        MonthlyInsightService.Explanation explanation = service.parseExplanation(raw);

        assertNotNull(explanation);
        assertEquals("ok", explanation.summary());
        assertEquals(MonthlyInsightService.MAX_HIGHLIGHTS, explanation.highlights().size());
    }

    @Test
    void parseExplanationReturnsNullForNullInput() {
        assertNull(service.parseExplanation(null));
    }

    @Test
    void unauthenticatedRequestIsRejected() {
        ResponseStatusException exception = org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> service.generateForAuthenticatedUser(null, 2026, 8));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verify(aiClient, never()).complete(anyString(), anyString());
    }

    @Test
    void unknownUserIsRejected() {
        when(userRepository.findByIdForUpdate("user-1")).thenReturn(java.util.Optional.empty());

        ResponseStatusException exception = org.junit.jupiter.api.Assertions.assertThrows(
                ResponseStatusException.class,
                () -> service.generateForAuthenticatedUser(AUTH, 2026, 8));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verify(reports, never()).facts(any(), anyInt(), anyInt());
    }
}
