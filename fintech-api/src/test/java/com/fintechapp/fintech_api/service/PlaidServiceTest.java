package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Verifies the production classification wiring: a raw Plaid
 * /transactions/sync payload is mapped by {@link PlaidService} through
 * {@link PlaidTransferDetector} into {@link PlaidTransaction} records whose
 * {@code transfer} flag is correct before it reaches the persistence layer.
 *
 * <p>This is the layer the payroll bug lived in: the detector result must flow
 * into the stored {@code is_transfer} value unchanged.</p>
 */
@ExtendWith(MockitoExtension.class)
class PlaidServiceTest {

    private static final String ACCESS_TOKEN = "access-token-1";

    private final ObjectMapper mapper = new ObjectMapper();

    @Mock
    private RestClient plaidRestClient;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PlaidTransactionIngestService ingestService;

    private PlaidService service;
    private User user;
    private PlaidItem item;

    @BeforeEach
    void setUp() {
        PlaidSettings settings = new PlaidSettings(
                "client-id", "secret", "https://sandbox.plaid.com", "https://example.com/webhook",
                List.of("US"), "en");
        service = new PlaidService(
                plaidRestClient, settings, encryptionService, plaidItemRepository, userRepository, ingestService);

        user = new User();
        user.setId("user-1");
        user.setCurrency("USD");

        item = new PlaidItem();
        item.setItemId("item-1");
        item.setAccessTokenEncrypted("encrypted");
        item.setCursor(null);
        item.setUser(user);
    }

    private void stubSyncPage(JsonNode payload) {
        RestClient.RequestBodyUriSpec postSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(plaidRestClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        // `body(Object)` is overloaded with `body(StreamingHttpOutputMessage.Body)`;
        // typing the matcher as Object targets the plain Map overload used here.
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(JsonNode.class)).thenReturn(payload);

        when(encryptionService.decrypt("encrypted")).thenReturn(ACCESS_TOKEN);
        when(plaidItemRepository.findByItemIdForUpdate("item-1")).thenReturn(Optional.of(item));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
    }

    /** Stubs the Plaid HTTP call to throw a Plaid error response (non-2xx status). */
    private void stubSyncPageError(String errorBody) {
        RestClient.RequestBodyUriSpec postSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(plaidRestClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(JsonNode.class)).thenThrow(new RestClientResponseException(
                "400 Bad Request", 400, "Bad Request", HttpHeaders.EMPTY,
                errorBody.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));

        when(encryptionService.decrypt("encrypted")).thenReturn(ACCESS_TOKEN);
        when(plaidItemRepository.findByItemIdForUpdate("item-1")).thenReturn(Optional.of(item));
        // userRepository.findById is intentionally NOT stubbed: the post() call
        // throws before the user lookup runs on the error path.
    }

    private JsonNode json(String raw) throws Exception {
        return mapper.readTree(raw);
    }

    @Test
    void syncPage_categorySignalsDoNotProveTransfer_forAnyTransaction() throws Exception {
        JsonNode payload = json("""
                {
                  "added": [
                    {
                      "transaction_id": "pay-1",
                      "name": "ACME CORP PAYROLL",
                      "amount": -2500.0,
                      "date": "2026-01-10",
                      "account_id": "account-123",
                      "personal_finance_category": {
                        "primary": "INCOME",
                        "detailed": "INCOME_PAYROLL",
                        "subcategory": "INCOME_PAYROLL" },
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "pay-2",
                      "name": "ACME CORP",
                      "description": "PAYROLL DEPOSIT",
                      "amount": -2000.0,
                      "date": "2026-01-11",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "category": ["Transfer", "Deposit"],
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "tr-1",
                      "name": "Checking to Savings",
                      "amount": 1000.0,
                      "date": "2026-01-12",
                      "account_id": "checking-123",
                      "personal_finance_category": { "primary": "TRANSFER_OUT" },
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "tr-2",
                      "name": "Transfer from Checking",
                      "amount": -1000.0,
                      "date": "2026-01-12",
                      "account_id": "savings-123",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "cc-1",
                      "name": "PAYMENT THANK YOU / PAIEMENT T MERCI",
                      "amount": -500.0,
                      "date": "2026-01-13",
                      "personal_finance_category": {
                        "primary": "LOAN_PAYMENTS",
                        "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
                      "category": ["Payment", "Credit Card"],
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "buy-1",
                      "name": "STARBUCKS",
                      "amount": 5.0,
                      "date": "2026-01-14",
                      "personal_finance_category": {
                        "primary": "FOOD_AND_DRINK",
                        "detailed": "FOOD_AND_DRINK_COFFEE" },
                      "iso_currency_code": "USD"
                    }
                  ],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-1",
                  "has_more": false
                }
                """);
        stubSyncPage(payload);

        service.fetchAndApplySyncPage("item-1");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PlaidTransaction>> addedCaptor = ArgumentCaptor.forClass(List.class);
        verify(ingestService).upsertAddedBatch(any(User.class), addedCaptor.capture());
        List<PlaidTransaction> added = addedCaptor.getValue();
        assertEquals(6, added.size());

        // TEST 1 — PAYROLL: PFC detailed contains PAYROLL → never a transfer.
        assertFalse(txById(added, "pay-1").transfer());

        // TEST 2 — PAYROLL DEPOSIT DESCRIPTION → never a transfer, even when
        // Plaid categorized the deposit as TRANSFER_IN / legacy Transfer.
        assertFalse(txById(added, "pay-2").transfer());

        // TEST 3 — TRANSFER_OUT/IN pair: the strict rule requires proving both
        // accounts belong to the same user at the same institution, which the
        // app cannot do from category data → safe default (not a transfer).
        assertFalse(txById(added, "tr-1").transfer());
        assertFalse(txById(added, "tr-2").transfer());

        // TEST 4 — CREDIT CARD PAYMENT: same-institution ownership cannot be
        // proven → never classified as a transfer by the detector.
        assertFalse(txById(added, "cc-1").transfer());

        // TEST 5 — REAL EXPENSE (ordinary purchase) → not a transfer.
        assertFalse(txById(added, "buy-1").transfer());

        // The Plaid account_id and item_id are captured from the raw payload and
        // threaded into the ingest record (item-1 comes from the synced item).
        assertEquals("account-123", txById(added, "pay-1").plaidAccountId());
        assertEquals("item-1", txById(added, "pay-1").plaidItemId());
        assertEquals("checking-123", txById(added, "tr-1").plaidAccountId());
        assertEquals("savings-123", txById(added, "tr-2").plaidAccountId());
        assertNotEquals(txById(added, "tr-1").plaidAccountId(), txById(added, "tr-2").plaidAccountId());
        assertEquals("item-1", txById(added, "tr-1").plaidItemId());

        // The next_cursor is committed.
        assertEquals("cursor-1", item.getCursor());
    }

    @Test
    void syncPage_refundIsNeverATransfer() throws Exception {
        JsonNode payload = json("""
                {
                  "added": [
                    {
                      "transaction_id": "ref-1",
                      "name": "REFUND STARBUCKS",
                      "amount": -12.0,
                      "date": "2026-01-14",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "category": ["Transfer", "Deposit", "Refund"],
                      "iso_currency_code": "USD"
                    }
                  ],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-2",
                  "has_more": false
                }
                """);
        stubSyncPage(payload);

        service.fetchAndApplySyncPage("item-1");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PlaidTransaction>> addedCaptor = ArgumentCaptor.forClass(List.class);
        verify(ingestService).upsertAddedBatch(any(User.class), addedCaptor.capture());
        // TEST 6 — REFUND → not a transfer.
        assertFalse(txById(addedCaptor.getValue(), "ref-1").transfer());
    }

    @Test
    void syncPage_ppdIdPayrollTransferPayrollCashDepositAndCardPurchase() throws Exception {
        // Production patterns from the confirmed bugs, run through the real
        // PlaidService mapping path.
        JsonNode payload = json("""
                {
                  "added": [
                    {
                      "transaction_id": "pay-ppd",
                      "name": "Sweetgreen",
                      "description": "SWEETGREEN INC PAYROLL PPD ID",
                      "amount": -800.0,
                      "date": "2026-02-01",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "category": ["Transfer", "Deposit"],
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "pay-transfer",
                      "name": "ACME PAYROLL",
                      "description": "ACME CORP",
                      "amount": -2000.0,
                      "date": "2026-02-01",
                      "personal_finance_category": {
                        "primary": "TRANSFER_IN",
                        "detailed": "TRANSFER_PAYROLL",
                        "subcategory": "TRANSFER_PAYROLL" },
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "cash-1",
                      "name": "CASH DEPOSIT",
                      "description": "CASH DEPOSIT ATM 1234",
                      "amount": -500.0,
                      "date": "2026-02-02",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "category": ["Transfer", "Deposit"],
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "netflix-1",
                      "name": "Netflix",
                      "amount": 15.99,
                      "date": "2026-02-03",
                      "personal_finance_category": {
                        "primary": "ENTERTAINMENT",
                        "detailed": "ENTERTAINMENT_MEDIA_AND_STREAMING" },
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "cc-mobile",
                      "name": "VISA PAYMENT",
                      "description": "Payment Thank You-Mobile",
                      "amount": 350.0,
                      "date": "2026-02-04",
                      "personal_finance_category": {
                        "primary": "LOAN_PAYMENTS",
                        "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
                      "iso_currency_code": "USD"
                    }
                  ],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-3",
                  "has_more": false
                }
                """);
        stubSyncPage(payload);

        service.fetchAndApplySyncPage("item-1");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PlaidTransaction>> addedCaptor = ArgumentCaptor.forClass(List.class);
        verify(ingestService).upsertAddedBatch(any(User.class), addedCaptor.capture());
        List<PlaidTransaction> added = addedCaptor.getValue();
        assertEquals(5, added.size());

        // TEST 3 — PAYROLL BY PPD ID → income, never a transfer.
        assertFalse(txById(added, "pay-ppd").transfer());
        // TEST 1 — PAYROLL BY DETAILED TRANSFER_PAYROLL → income, never a transfer.
        assertFalse(txById(added, "pay-transfer").transfer());
        // BUG 4 — CASH DEPOSIT under a TRANSFER_IN umbrella → not a transfer.
        assertFalse(txById(added, "cash-1").transfer());
        // TEST 6 / BUG 3 — Netflix subscription → a real expense, not a transfer.
        assertFalse(txById(added, "netflix-1").transfer());
        // CREDIT CARD PAYMENT by detailed + mobile descriptor → NOT a transfer:
        // same-institution ownership cannot be proven from category data.
        assertFalse(txById(added, "cc-mobile").transfer());
    }

    @Test
    void syncPage_plaidIncPayrollRegSalary_isIncomeNotTransfer() throws Exception {
        // Exact confirmed production case: the word PAYROLL in the description
        // must force is_transfer = false through the real mapping path.
        JsonNode payload = json("""
                {
                  "added": [
                    {
                      "transaction_id": "pay-plaid",
                      "name": "PLAID INC",
                      "description": "PLAID INC PAYROLL REG SALARY",
                      "amount": -1750.0,
                      "date": "2026-03-01",
                      "personal_finance_category": { "primary": "TRANSFER_IN" },
                      "category": ["Transfer", "Deposit"],
                      "iso_currency_code": "USD"
                    },
                    {
                      "transaction_id": "pay-wages",
                      "name": "ACME WAGES",
                      "description": "ACME WAGES",
                      "amount": -2000.0,
                      "date": "2026-03-02",
                      "personal_finance_category": {
                        "primary": "INCOME",
                        "detailed": "INCOME_WAGES" },
                      "category": ["Transfer", "Deposit"],
                      "iso_currency_code": "USD"
                    }
                  ],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-4",
                  "has_more": false
                }
                """);
        stubSyncPage(payload);

        service.fetchAndApplySyncPage("item-1");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PlaidTransaction>> addedCaptor = ArgumentCaptor.forClass(List.class);
        verify(ingestService).upsertAddedBatch(any(User.class), addedCaptor.capture());
        List<PlaidTransaction> added = addedCaptor.getValue();
        assertEquals(2, added.size());

        // "PLAID INC PAYROLL REG SALARY" → income, never a transfer.
        assertFalse(txById(added, "pay-plaid").transfer());
        // primary == INCOME → income, never a transfer (even with legacy Transfer).
        assertFalse(txById(added, "pay-wages").transfer());
    }

    @Test
    void syncPage_plaidErrorResponse_surfacesActualPlaidError() {
        // Plaid rejects the request (e.g. INVALID_API_KEYS). The error payload
        // must be surfaced in the 502 message and the full body logged — not
        // swallowed into a generic "unavailable" message.
        String errorBody = """
                {"display_message":null,"error_code":"INVALID_API_KEYS",
                 "error_message":"invalid client_id or secret provided",
                 "error_type":"INVALID_INPUT","request_id":"abc123"}
                """;
        stubSyncPageError(errorBody);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.fetchAndApplySyncPage("item-1"));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertTrue(ex.getReason().contains("INVALID_API_KEYS"));
        assertTrue(ex.getReason().contains("invalid client_id or secret provided"));
    }

    @Test
    void syncPage_plaidErrorResponse_nonJsonBody_isSurfacedRaw() {
        // An intermediary (e.g. a proxy error page) returning non-JSON must not
        // be lost either.
        stubSyncPageError("<html>502 Bad Gateway</html>");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.fetchAndApplySyncPage("item-1"));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertTrue(ex.getReason().contains("<html>502 Bad Gateway</html>"));
    }

    @Test
    void createUpdateLinkToken_buildsUpdateModeBodyWithoutProducts() throws Exception {
        // owned item with an encrypted access token, resolved by internal id
        PlaidItem owned = new PlaidItem();
        owned.setItemId("plaid-item-1");
        owned.setAccessTokenEncrypted("encrypted");
        owned.setUser(user);
        when(plaidItemRepository.findByIdAndUser_Id("internal-id", "user-1")).thenReturn(Optional.of(owned));
        when(encryptionService.decrypt("encrypted")).thenReturn(ACCESS_TOKEN);

        RestClient.RequestBodyUriSpec postSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);
        when(plaidRestClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(JsonNode.class)).thenReturn(json("{\"link_token\":\"link-update-123\"}"));

        String linkToken = service.createUpdateLinkToken(
                new AuthenticatedUser("user-1", "user@example.com", 1L), "internal-id");

        assertEquals("link-update-123", linkToken);

        // The update-mode body MUST reuse the access_token and MUST NOT include
        // a products array (which would create a new authorization/connection).
        ArgumentCaptor<Object> bodyCaptor = ArgumentCaptor.forClass(Object.class);
        verify(bodySpec).body(bodyCaptor.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) bodyCaptor.getValue();
        assertEquals(ACCESS_TOKEN, body.get("access_token"));
        assertFalse(body.containsKey("products"));
        assertEquals("Budgee", body.get("client_name"));
        assertEquals(List.of("US"), body.get("country_codes"));
        assertEquals("en", body.get("language"));
        assertEquals("https://example.com/webhook", body.get("webhook"));
    }

    private PlaidTransaction txById(List<PlaidTransaction> transactions, String id) {
        return transactions.stream()
                .filter(tx -> id.equals(tx.transactionId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing transaction " + id));
    }
}
