package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService;
import com.fintechapp.fintech_api.service.PlaidSyncLockService;
import com.fintechapp.fintech_api.service.PlaidTransactionSyncService;
import com.fintechapp.fintech_api.service.PlaidWebhookService;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PlaidItemHealthConcurrencyIntegrationTest extends BaseIntegrationTest {

    private static final Instant NEW_EXPIRY = Instant.parse("2030-01-01T00:00:00Z");
    private static final Instant NEW_SYNC_TIME = Instant.parse("2026-10-01T00:00:00Z");

    @Autowired private PlaidItemRepository items;
    @Autowired private PlaidWebhookService webhooks;
    @Autowired private PlaidService plaidService;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;

    @ParameterizedTest
    @CsvSource({
            "REAUTH_REQUIRED,false", "REAUTH_REQUIRED,true",
            "LOGIN_REPAIRED,false", "LOGIN_REPAIRED,true",
            "COMPLETE_REAUTH,false", "COMPLETE_REAUTH,true",
            "SYNC_ERROR,false", "SYNC_ERROR,true",
            "SYNC_SUCCESS,false", "SYNC_SUCCESS,true"
    })
    void healthUpdatePreservesNewerSyncState(String operation, boolean releasedLease) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        User user = createUser("health-" + UUID.randomUUID() + "@example.com", "Password123!", "HealthTest");
        PlaidItem item = tx.execute(status -> {
            PlaidItem created = new PlaidItem();
            created.setUser(user);
            created.setItemId("health-" + UUID.randomUUID());
            created.setAccessTokenEncrypted("encrypted-old");
            created.setCursor("C0");
            created.setSyncLockToken("L1");
            created.setSyncLockExpiresAt(Instant.parse("2029-01-01T00:00:00Z"));
            created.setStatus(operation.equals("REAUTH_REQUIRED")
                    ? PlaidItemStatus.ACTIVE : PlaidItemStatus.REQUIRES_REAUTH);
            created.setReauthRequestedAt(operation.equals("REAUTH_REQUIRED") ? null : Instant.EPOCH);
            created.setSyncError(operation.equals("SYNC_SUCCESS"));
            return items.saveAndFlush(created);
        });

        try {
            tx.executeWithoutResult(status -> {
                // Keep C0/L1 in this persistence context while a separate transaction
                // commits C1 and newer ownership. A whole-entity health save used to
                // flush or merge this stale snapshot over the committed sync state.
                PlaidItem stale = items.findByItemId(item.getItemId()).orElseThrow();
                assertEquals("C0", stale.getCursor());
                assertEquals("L1", stale.getSyncLockToken());
                TransactionTemplate concurrent = new TransactionTemplate(transactionManager);
                concurrent.setPropagationBehavior(Propagation.REQUIRES_NEW.value());
                concurrent.executeWithoutResult(other -> jdbc.update("""
                        UPDATE plaid_items SET cursor = 'C1', sync_lock_token = ?,
                            sync_lock_expires_at = ?, last_synced_at = ?,
                            institution_name = 'New institution', access_token_encrypted = 'encrypted-new'
                        WHERE id = ?
                        """, releasedLease ? null : "L2",
                        releasedLease ? null : java.sql.Timestamp.from(NEW_EXPIRY),
                        java.sql.Timestamp.from(NEW_SYNC_TIME), item.getId()));
                performHealthUpdate(operation, item, user);
            });

            PlaidItem current = items.findByItemId(item.getItemId()).orElseThrow();
            assertEquals("C1", current.getCursor());
            assertEquals(releasedLease ? null : "L2", current.getSyncLockToken());
            assertEquals(releasedLease ? null : NEW_EXPIRY, current.getSyncLockExpiresAt());
            assertEquals(NEW_SYNC_TIME, current.getLastSyncedAt());
            assertEquals("New institution", current.getInstitutionName());
            assertEquals("encrypted-new", current.getAccessTokenEncrypted());
            if (operation.equals("REAUTH_REQUIRED")) {
                assertEquals(PlaidItemStatus.REQUIRES_REAUTH, current.getStatus());
                assertNotNull(current.getReauthRequestedAt());
            } else if (operation.equals("LOGIN_REPAIRED") || operation.equals("COMPLETE_REAUTH")) {
                assertEquals(PlaidItemStatus.ACTIVE, current.getStatus());
                assertNull(current.getReauthRequestedAt());
            } else {
                assertEquals(PlaidItemStatus.REQUIRES_REAUTH, current.getStatus());
                assertEquals(Instant.EPOCH, current.getReauthRequestedAt());
            }
            assertEquals(operation.equals("SYNC_ERROR"), current.isSyncError());
        } finally {
            tx.executeWithoutResult(status -> {
                items.deleteByUser_Id(user.getId());
                userRepository.deleteById(user.getId());
            });
        }
    }

    private void performHealthUpdate(String operation, PlaidItem item, User user) {
        switch (operation) {
            case "REAUTH_REQUIRED", "LOGIN_REPAIRED" -> webhooks.handleWebhook(Map.of(
                    "webhook_type", "ITEM", "item_id", item.getItemId(),
                    "webhook_code", operation.equals("REAUTH_REQUIRED") ? "ITEM_LOGIN_REQUIRED" : "LOGIN_REPAIRED"));
            case "COMPLETE_REAUTH" -> {
                PlaidItem refreshed = plaidService.completeReauth(
                        new AuthenticatedUser(user.getId(), user.getEmail(), 0L), item.getId());
                assertEquals(PlaidItemStatus.ACTIVE, refreshed.getStatus());
                assertEquals("C1", refreshed.getCursor());
            }
            default -> {
                // Invoke the driver synchronously so the held snapshot and health
                // update share the persistence context; external Plaid/lease calls
                // are mocked, but all health SQL uses the real repository/database.
                PlaidService fetcher = mock(PlaidService.class);
                PlaidSyncLockService locks = mock(PlaidSyncLockService.class);
                when(locks.acquireWithTimeout(any(), any(), any(), any())).thenReturn(true);
                when(locks.extend(any(), any(), any())).thenReturn(true);
                if (operation.equals("SYNC_ERROR")) {
                    when(fetcher.fetchAndApplySyncPage(org.mockito.ArgumentMatchers.eq(item.getItemId()), any())).thenThrow(new IllegalStateException("sync failed"));
                } else {
                    when(fetcher.fetchAndApplySyncPage(org.mockito.ArgumentMatchers.eq(item.getItemId()), any())).thenReturn(new PlaidService.SyncPageResult("C1", false));
                }
                new PlaidTransactionSyncService(items, fetcher, locks).syncItemAsync(item.getItemId());
            }
        }
    }

    @Test
    @Transactional
    void completeReauthRejectsAnotherUsersItem() {
        User owner = createUser("owner-" + UUID.randomUUID() + "@example.com", "Password123!", "Owner");
        PlaidItem item = new PlaidItem();
        item.setUser(owner);
        item.setItemId("owned-" + UUID.randomUUID());
        item.setAccessTokenEncrypted("encrypted");
        item.setStatus(PlaidItemStatus.REQUIRES_REAUTH);
        items.saveAndFlush(item);

        assertEquals(404, assertThrows(ResponseStatusException.class, () -> plaidService.completeReauth(
                new AuthenticatedUser("another-user", "other@example.com", 0L), item.getId()))
                .getStatusCode().value());
        assertEquals(PlaidItemStatus.REQUIRES_REAUTH, items.findById(item.getId()).orElseThrow().getStatus());
    }
}
