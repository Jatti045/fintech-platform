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
import com.fintechapp.fintech_api.dto.plaid.ManualSyncResponse;
import com.fintechapp.fintech_api.dto.plaid.PlaidItemResponse;
import com.fintechapp.fintech_api.dto.plaid.PlaidItemsResponse;
import com.fintechapp.fintech_api.dto.plaid.ReauthCompleteRequest;
import com.fintechapp.fintech_api.dto.plaid.ReauthCompleteResponse;
import com.fintechapp.fintech_api.dto.plaid.UpdateLinkTokenRequest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.service.PlaidService;
import com.fintechapp.fintech_api.service.PlaidSyncJobService;
import com.fintechapp.fintech_api.service.PlaidWebhookService;
import com.fintechapp.fintech_api.service.PlaidWebhookVerificationService;

import jakarta.validation.Valid;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Plaid integration endpoints. Link-token creation and token exchange are
 * authenticated; the webhook endpoint is public (see {@code SecurityConfig})
 * and acknowledges sync events only after their PostgreSQL job has committed.
 */
@RestController
@RequestMapping("/api/plaid")
public class PlaidController {

    private static final Logger logger = LoggerFactory.getLogger(PlaidController.class);
    private static final String PLAID_VERIFICATION_HEADER = "Plaid-Verification";

    private final PlaidService plaidService;
    private final PlaidSyncJobService syncJobs;
    private final PlaidWebhookService webhookService;
    private final PlaidWebhookVerificationService webhookVerificationService;
    private final ObjectMapper objectMapper;

    public PlaidController(
            PlaidService plaidService,
            PlaidSyncJobService syncJobs,
            PlaidWebhookService webhookService,
            PlaidWebhookVerificationService webhookVerificationService,
            ObjectMapper objectMapper) {
        this.plaidService = plaidService;
        this.syncJobs = syncJobs;
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

        PlaidSyncJobService.JobStatus jobStatus = syncJobs.requestSync(item.getItemId(), false);

        PlaidItemResponse response = new PlaidItemResponse(
                item.getId(), item.getItemId(), item.getInstitutionName(), item.getCreatedAt(),
                item.getStatus() == null ? "ACTIVE" : item.getStatus().name(),
                item.isSyncError(), item.getLastSyncedAt(), item.getReauthRequestedAt(),
                clientSyncStatus(jobStatus.status()), jobStatus.attemptCount(), jobStatus.nextAttemptAt());
        return new ExchangeTokenResponse(true, "Bank connected", new ExchangeTokenResponse.Data(response));
    }

    /** Lists the active bank connections for the authenticated user. */
    @GetMapping("/items")
    public PlaidItemsResponse listItems(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        List<PlaidItemResponse> items = plaidService.listItems(authenticatedUser).stream()
                .map(item -> {
                    PlaidSyncJobService.JobStatus status = syncJobs.statusForItem(item.itemId())
                            .orElse(new PlaidSyncJobService.JobStatus(
                                    item.lastSyncedAt() == null ? "QUEUED" : "SUCCEEDED", 0, null));
                    return new PlaidItemResponse(item.id(), item.itemId(), item.institutionName(), item.createdAt(),
                            item.status(), item.syncError(), item.lastSyncedAt(), item.reauthRequestedAt(),
                            clientSyncStatus(status.status()), status.attemptCount(), status.nextAttemptAt());
                }).toList();
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
     * Creates an update-mode Plaid Link token so the user can repair a
     * connection that needs re-authentication. Re-uses the existing
     * access_token and does NOT exchange a new public token after completion.
     */
    @PostMapping("/link-token/update")
    public LinkTokenResponse createUpdateLinkToken(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody UpdateLinkTokenRequest request) {
        String linkToken = plaidService.createUpdateLinkToken(authenticatedUser, request.itemId());
        return new LinkTokenResponse(true, "Update link token created", new LinkTokenResponse.Data(linkToken));
    }

    /**
     * Marks the item {@code ACTIVE} again after the user completes update mode
     * and kicks off a transaction sync so the repaired connection's data is
     * refreshed immediately.
     */
    @PostMapping("/items/reauth-complete")
    public ReauthCompleteResponse completeReauth(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody ReauthCompleteRequest request) {
        PlaidItem item = plaidService.completeReauth(authenticatedUser, request.itemId());
        PlaidSyncJobService.JobStatus jobStatus = syncJobs.requestSync(item.getItemId(), false);
        return new ReauthCompleteResponse(true, "Bank connection repaired",
                new ReauthCompleteResponse.Data(item.getItemId(),
                        item.getStatus() == null ? "ACTIVE" : item.getStatus().name(),
                        clientSyncStatus(jobStatus.status())));
    }

    /**
     * Manually queues a transaction sync for the given item. A 202 response
     * means the request was durably recorded, not that synchronization ended.
     */
    @PostMapping("/sync/{itemId}")
    public ResponseEntity<ManualSyncResponse> manualSync(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String itemId) {
        PlaidItem item = plaidService.findOwnedItem(authenticatedUser, itemId);
        PlaidSyncJobService.JobStatus jobStatus = syncJobs.requestSync(item.getItemId(), true);
        if ("ACTION_REQUIRED".equals(jobStatus.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Reconnect this bank before syncing.");
        }
        return ResponseEntity.accepted().body(new ManualSyncResponse(true, "Transaction sync queued",
                new ManualSyncResponse.Data(item.getItemId(), clientSyncStatus(jobStatus.status()),
                        jobStatus.nextAttemptAt())));
    }

    /**
     * Public Plaid webhook endpoint. Sync requests are durably recorded before
     * successful acknowledgment; a queue persistence failure returns 5xx.
     *
     * <p>
     * Every incoming request must provide a valid {@code Plaid-Verification}
     * JWT signed by Plaid. The signature, age (within 5 minutes), and body hash
     * are cryptographically verified before the payload is parsed or trusted.
     * Requests without a valid verification header are rejected immediately
     * with 401 Unauthorized.
     * </p>
     */
    @PostMapping({ "/webhook", "/webhook/" })
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = PLAID_VERIFICATION_HEADER, required = false) String verificationHeader) {
        if (!StringUtils.hasText(verificationHeader)) {
            logger.warn("Plaid webhook rejected: missing {} header", PLAID_VERIFICATION_HEADER);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Plaid webhook verification header missing");
        }
        if (!webhookVerificationService.verify(verificationHeader, rawBody)) {
            logger.warn("Plaid webhook rejected: signature verification failed");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Plaid webhook verification failed");
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() {
            });
        } catch (JacksonException ex) {
            // Malformed payload — dead-letter and ack 200 so Plaid does not retry.
            logger.error("Received malformed Plaid webhook payload; dead-lettering: {}", ex.getMessage());
            webhookService.deadLetterWebhook(rawBody, ex);
            return ResponseEntity.ok(Map.of("success", true));
        }

        try {
            webhookService.handleWebhook(payload);
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode().is4xxClientError()) {
                logger.warn("Rejected verified Plaid webhook payload with status={}", ex.getStatusCode().value());
                webhookService.deadLetterWebhook(rawBody, ex);
                return ResponseEntity.ok(Map.of("success", true));
            }
            throw ex;
        } catch (RuntimeException ex) {
            // In particular, do not acknowledge a sync event when PostgreSQL
            // could not durably record its job; Plaid can redeliver it.
            logger.error("Verified Plaid webhook could not be durably processed ({})", ex.getClass().getSimpleName());
            throw ex;
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static String clientSyncStatus(String status) {
        return "PROCESSING".equals(status) ? "SYNCING" : status;
    }
}
