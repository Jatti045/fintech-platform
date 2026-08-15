package com.fintechapp.fintech_api.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.plaid.DisconnectItemResponse;
import com.fintechapp.fintech_api.dto.plaid.ExchangePublicTokenRequest;
import com.fintechapp.fintech_api.dto.plaid.ExchangeTokenResponse;
import com.fintechapp.fintech_api.dto.plaid.LinkTokenResponse;
import com.fintechapp.fintech_api.dto.plaid.PlaidItemResponse;
import com.fintechapp.fintech_api.dto.plaid.PlaidItemsResponse;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.service.PlaidService;
import com.fintechapp.fintech_api.service.PlaidTransactionSyncService;
import com.fintechapp.fintech_api.service.PlaidWebhookService;
import com.fintechapp.fintech_api.service.PlaidWebhookVerificationService;

import jakarta.validation.Valid;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Plaid integration endpoints. Link-token creation and token exchange are
 * authenticated; the webhook endpoint is public (see {@code SecurityConfig})
 * and is acknowledged immediately with 200 OK before async sync begins.
 */
@RestController
@RequestMapping("/api/plaid")
public class PlaidController {

    private static final Logger logger = LoggerFactory.getLogger(PlaidController.class);
    private static final String PLAID_VERIFICATION_HEADER = "Plaid-Verification";

    private final PlaidService plaidService;
    private final PlaidTransactionSyncService syncService;
    private final PlaidWebhookService webhookService;
    private final PlaidWebhookVerificationService webhookVerificationService;
    private final ObjectMapper objectMapper;

    public PlaidController(
            PlaidService plaidService,
            PlaidTransactionSyncService syncService,
            PlaidWebhookService webhookService,
            PlaidWebhookVerificationService webhookVerificationService,
            ObjectMapper objectMapper) {
        this.plaidService = plaidService;
        this.syncService = syncService;
        this.webhookService = webhookService;
        this.webhookVerificationService = webhookVerificationService;
        this.objectMapper = objectMapper;
    }

    /** Generates a Plaid Link token for the authenticated user. */
    @PostMapping("/link-token")
    public LinkTokenResponse createLinkToken(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        String linkToken = plaidService.createLinkToken(authenticatedUser);
        return new LinkTokenResponse(true, "Link token created", new LinkTokenResponse.Data(linkToken));
    }

    /** Exchanges the frontend-returned public token for a persisted Plaid item. */
    @PostMapping("/token")
    public ExchangeTokenResponse exchangePublicToken(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody ExchangePublicTokenRequest request) {
        PlaidItem item = plaidService.exchangePublicToken(authenticatedUser, request.publicToken());

        // Kick off the initial ingestion on a background thread so the client
        // gets a response immediately; later updates arrive via webhooks.
        syncService.syncItemAsync(item.getItemId());

        PlaidItemResponse response = new PlaidItemResponse(
                item.getId(), item.getItemId(), item.getInstitutionName(), item.getCreatedAt());
        return new ExchangeTokenResponse(true, "Bank connected", new ExchangeTokenResponse.Data(response));
    }

    /** Lists the active bank connections for the authenticated user. */
    @GetMapping("/items")
    public PlaidItemsResponse listItems(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        List<PlaidItemResponse> items = plaidService.listItems(authenticatedUser);
        return new PlaidItemsResponse(true, "Bank connections loaded", new PlaidItemsResponse.Data(items));
    }

    /** Revokes a Plaid item at Plaid and removes it from the user's profile. */
    @DeleteMapping("/items/{itemId}")
    public DisconnectItemResponse disconnectItem(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String itemId) {
        String deletedItemId = plaidService.disconnectItem(authenticatedUser, itemId);
        return new DisconnectItemResponse(true, "Bank disconnected", new DisconnectItemResponse.Data(deletedItemId));
    }

    /**
     * Public Plaid webhook endpoint. Acknowledged synchronously; the actual
     * /transactions/sync work is dispatched asynchronously.
     *
     * <p>
     * When Plaid attaches the {@code Plaid-Verification} JWT it is verified
     * against Plaid's published key (signature, age and body hash) before the
     * payload is trusted. Webhooks without the header are logged and still
     * processed, matching Plaid's guidance that verification is optional.
     * </p>
     */
    @PostMapping({"/webhook", "/webhook/"})
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = PLAID_VERIFICATION_HEADER, required = false) String verificationHeader) {
        if (!StringUtils.hasText(verificationHeader)) {
            logger.warn("Plaid webhook received without {} header; skipping signature verification",
                    PLAID_VERIFICATION_HEADER);
        } else if (!webhookVerificationService.verify(verificationHeader, rawBody)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Plaid webhook verification failed");
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() { });
        } catch (JacksonException ex) {
            logger.warn("Received malformed Plaid webhook payload: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Plaid webhook payload", ex);
        }

        webhookService.handleWebhook(payload);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
