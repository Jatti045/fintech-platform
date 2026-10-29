package com.fintechapp.fintech_api.integration.service;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.*;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PlaidRevocationIntegrationTest extends BaseIntegrationTest {
    private static final PlaidSettings SETTINGS = new PlaidSettings(
            "client", "secret", "https://sandbox.plaid.com", "", List.of("US"), "en");
    @Autowired private PlaidService plaid;
    @Autowired private UserService users;
    @Autowired private PlaidItemRepository items;
    @Autowired private PlaidRevocationJobService jobs;
    @Autowired private PlaidSyncJobService syncJobs;
    @Autowired private PlaidSyncLockService syncLeases;
    @Autowired private PlaidTransactionIngestService ingest;
    @Autowired private InternalTransferReconciliationService transfers;
    @Autowired private EncryptionService encryption;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager manager;
    @MockitoBean private FinancialCacheInvalidator cache;

    private User user;
    private AuthenticatedUser auth;
    private final List<String> jobIds = new ArrayList<>();

    @BeforeEach
    void prepare() {
        user = createUser("revoke-" + UUID.randomUUID() + "@example.com", "Password123!", "revocation");
        auth = new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
    }

    @AfterEach
    void clean() {
        new TransactionTemplate(manager).executeWithoutResult(s -> {
            transactionRepository.deleteByUser_Id(user.getId());
            budgetRepository.deleteByUser_Id(user.getId());
            items.deleteByUser_Id(user.getId());
            for (String id : jobIds) jdbc.update("DELETE FROM plaid_revocation_jobs WHERE id=?", id);
            if (userRepository.existsById(user.getId())) userRepository.deleteById(user.getId());
        });
    }

    @Test
    void disconnectDisablesSyncKeepsHistoryAndDurablyQueuesEncryptedCredential() throws Exception {
        PlaidItem item = item("access-sandbox-disconnect");
        syncJobs.requestSync(item.getItemId(), true);
        createTransaction(user, null, "retained history", Instant.now(), "Food", TransactionType.EXPENSE, 10);

        mockMvc.perform(delete("/api/plaid/items/{id}", item.getId()).header(authHeaderName(), authHeader(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.deletedItemId").value(item.getId()))
                .andExpect(jsonPath("$.message").value(containsString("Remote revocation is pending")));
        assertFalse(items.existsById(item.getId()));
        assertTrue(syncJobs.statusForItem(item.getItemId()).isEmpty());
        assertEquals("REMOVED", syncJobs.requestSync(item.getItemId(), false).status());
        assertEquals(1, transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
        assertEquals(item.getAccessTokenEncrypted(), row(item).get("access_token_encrypted"));
        assertNotEquals("access-sandbox-disconnect", row(item).get("access_token_encrypted"));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> plaid.fetchAndApplySyncPage(item.getItemId(), "old-lease", new PlaidService.SyncAttempt())).getStatusCode());

        // A repeated request preserves the already accepted work and the existing 404 contract.
        mockMvc.perform(delete("/api/plaid/items/{id}", item.getId()).header(authHeaderName(), authHeader(user)))
                .andExpect(status().isNotFound());
        assertEquals(1, count(item));
    }

    @Test
    void accountDeletionQueuesEveryItemAndRetainsNoUserOrFinancialData() throws Exception {
        PlaidItem first = item("access-sandbox-first");
        PlaidItem second = item("access-sandbox-second");
        items.markRequiresReauth(second.getItemId(), PlaidItemStatus.REQUIRES_REAUTH, Instant.now());
        PlaidItem earlier = item("access-sandbox-earlier-disconnect");
        plaid.disconnectItem(auth, earlier.getId());
        syncJobs.requestSync(first.getItemId(), true);
        var budget = createBudget(user, "Food", 100, Instant.parse("2026-10-01T00:00:00Z"));
        createTransaction(user, budget, "delete history", Instant.now(), "Food", TransactionType.EXPENSE, 10);

        mockMvc.perform(delete("/api/users/{id}", user.getId()).header(authHeaderName(), authHeader(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value(containsString("revocations will continue in the background")));
        assertFalse(userRepository.existsById(user.getId()));
        assertTrue(items.findByUser_IdOrderByCreatedAtDesc(user.getId()).isEmpty());
        assertTrue(transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).isEmpty());
        assertTrue(budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).isEmpty());
        assertTrue(syncJobs.statusForItem(first.getItemId()).isEmpty());
        assertEquals(1, count(first)); assertEquals(1, count(second)); assertEquals(1, count(earlier));
        assertFalse(row(first).containsKey("user_id"));
        assertFalse(row(first).containsKey("item_id"));
        assertFalse(row(first).containsKey("institution_name"));

        Set<String> revoked = new HashSet<>();
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(ExpectedCount.times(3), requestTo(SETTINGS.baseUrl() + "/item/remove"))
                .andExpect(request -> {
                    assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
                    revoked.add(objectMapper.readTree(((MockClientHttpRequest) request).getBodyAsString())
                            .path("access_token").asString());
                }).andRespond(withSuccess("{\"request_id\":\"confirmed\"}", MediaType.APPLICATION_JSON));
        var worker = worker(builder.build(), jobs);
        worker.processOne(); worker.processOne(); worker.processOne();
        server.verify();
        assertEquals(Set.of("access-sandbox-first", "access-sandbox-second", "access-sandbox-earlier-disconnect"), revoked);
        assertEquals(0, count(first)); assertEquals(0, count(second)); assertEquals(0, count(earlier));
    }

    @Test
    void outagePersistsRetryAndFreshWorkerCompletesAfterRestart() {
        PlaidItem item = item("access-sandbox-restart");
        plaid.disconnectItem(auth, item.getId());
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(SETTINGS.baseUrl() + "/item/remove"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        worker(builder.build(), jobs).processOne();
        server.verify();
        var pending = row(item);
        assertEquals(1, pending.get("attempt_count"));
        assertEquals("HTTP_503", pending.get("last_error_code"));
        assertNotNull(pending.get("last_error_at"));
        assertNull(pending.get("lease_owner"));
        assertTrue(((java.sql.Timestamp) pending.get("next_attempt_at")).toInstant().isAfter(Instant.now()));
        assertEquals(item.getAccessTokenEncrypted(), pending.get("access_token_encrypted"));
        assertTrue(jobs.claimNext().isEmpty());

        due(item);
        var restartedJobs = new PlaidRevocationJobService(jdbc);
        var restartedBuilder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var restartedServer = MockRestServiceServer.bindTo(restartedBuilder).build();
        restartedServer.expect(requestTo(SETTINGS.baseUrl() + "/item/remove"))
                .andRespond(withSuccess("{\"request_id\":\"confirmed\"}", MediaType.APPLICATION_JSON));
        worker(restartedBuilder.build(), restartedJobs).processOne();
        restartedServer.verify();
        assertEquals(0, count(item));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void alreadyRemovedIsConfirmedButAmbiguousInvalidTokenIsRetained(boolean removed) {
        PlaidItem item = item("access-sandbox-already-removed");
        plaid.disconnectItem(auth, item.getId());
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        String code = removed ? "ITEM_NOT_FOUND" : "INVALID_ACCESS_TOKEN";
        String type = removed ? "ITEM_ERROR" : "INVALID_INPUT";
        server.expect(requestTo(SETTINGS.baseUrl() + "/item/remove"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error_type\":\"" + type + "\",\"error_code\":\"" + code + "\"}"));
        worker(builder.build(), jobs).processOne();
        server.verify();
        assertEquals(removed ? 0 : 1, count(item));
        if (!removed) assertEquals("INVALID_ACCESS_TOKEN", row(item).get("last_error_code"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void localDeletionAndRevocationOutboxRollBackTogether(boolean accountDeletion) {
        PlaidItem item = item("access-sandbox-rollback");
        syncJobs.requestSync(item.getItemId(), true);
        assertThrows(IllegalStateException.class, () -> new TransactionTemplate(manager).executeWithoutResult(s -> {
            if (accountDeletion) users.deleteAccount(user.getId(), auth);
            else plaid.disconnectItem(auth, item.getId());
            throw new IllegalStateException("simulate failure before commit");
        }));
        assertTrue(userRepository.existsById(user.getId()));
        assertTrue(items.existsById(item.getId()));
        assertTrue(syncJobs.statusForItem(item.getItemId()).isPresent());
        assertEquals(0, count(item));
    }

    @Test
    void concurrentClaimsAndExpiredLeasesAreFencedAcrossInstances() throws Exception {
        PlaidItem item = item("access-sandbox-lease");
        plaid.disconnectItem(auth, item.getId());
        var other = new PlaidRevocationJobService(jdbc);
        var pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            var a = pool.submit(() -> { await(start); return jobs.claimNext(); });
            var b = pool.submit(() -> { await(start); return other.claimNext(); });
            start.countDown();
            List<PlaidRevocationJobService.Claim> claims = new ArrayList<>();
            a.get(10, TimeUnit.SECONDS).ifPresent(claims::add);
            b.get(10, TimeUnit.SECONDS).ifPresent(claims::add);
            assertEquals(1, claims.size());
            var stale = claims.get(0);
            assertFalse(stale.toString().contains(item.getAccessTokenEncrypted()));
            jdbc.update("UPDATE plaid_revocation_jobs SET lease_expires_at=NOW() - INTERVAL '1 second' WHERE id=?", item.getId());
            var replacement = other.claimNext().orElseThrow();
            assertEquals(2, replacement.attemptCount());
            assertNotEquals(stale.owner(), replacement.owner());
            assertFalse(jobs.retry(stale, "STALE"));
            assertFalse(jobs.complete(stale));
            assertTrue(other.complete(replacement));
            assertEquals(0, count(item));
        } finally { stop(pool); }
    }

    @Test
    void repeatedFailuresNeverExhaustCleanupAndDuplicateEnqueueDoesNotResetBackoff() {
        PlaidItem item = item("access-sandbox-retries");
        new TransactionTemplate(manager).executeWithoutResult(s -> {
            jobs.enqueueForItem(item.getId()); jobs.enqueueForItem(item.getId());
        });
        for (int i = 1; i <= 12; i++) {
            var claim = jobs.claimNext().orElseThrow();
            assertEquals(i, claim.attemptCount());
            assertTrue(jobs.retry(claim, "HTTP_503"));
            Object deadline = row(item).get("next_attempt_at");
            new TransactionTemplate(manager).executeWithoutResult(s -> jobs.enqueueForItem(item.getId()));
            assertEquals(deadline, row(item).get("next_attempt_at"));
            assertTrue(jobs.claimNext().isEmpty());
            due(item);
        }
        assertEquals(item.getAccessTokenEncrypted(), row(item).get("access_token_encrypted"));
        plaid.disconnectItem(auth, item.getId());
        var finalAttempt = jobs.claimNext().orElseThrow();
        assertEquals(13, finalAttempt.attemptCount());
        assertTrue(jobs.complete(finalAttempt));
        assertEquals(0, count(item));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void inFlightSyncCannotRestoreDataAfterDisconnectionOrDeletion(boolean accountDeletion) throws Exception {
        PlaidItem item = item("access-sandbox-in-flight");
        assertTrue(syncLeases.tryAcquire(item.getItemId(), "worker", Duration.ofMinutes(5)));
        CountDownLatch requested = new CountDownLatch(1), release = new CountDownLatch(1);
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(SETTINGS.baseUrl() + "/transactions/sync")).andRespond(request -> {
            requested.countDown(); await(release);
            return withSuccess("""
                    {"next_cursor":"C1","has_more":false,"added":[
                      {"transaction_id":"ghost","amount":50,"date":"2026-10-01","name":"ghost"}],
                      "modified":[],"removed":[]}
                    """, MediaType.APPLICATION_JSON).createResponse(request);
        });
        PlaidService inFlight = service(builder.build());
        var pool = Executors.newSingleThreadExecutor();
        try {
            var future = pool.submit(() -> inFlight.fetchAndApplySyncPage(item.getItemId(), "worker", new PlaidService.SyncAttempt()));
            assertTrue(requested.await(10, TimeUnit.SECONDS));
            if (accountDeletion) users.deleteAccount(user.getId(), auth);
            else plaid.disconnectItem(auth, item.getId());
            release.countDown();
            assertInstanceOf(ResponseStatusException.class,
                    assertThrows(ExecutionException.class, () -> future.get(10, TimeUnit.SECONDS)).getCause());
            assertTrue(transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).isEmpty());
            assertTrue(budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).isEmpty());
            assertFalse(items.existsById(item.getId()));
            assertEquals(1, count(item));
            server.verify();
        } finally { release.countDown(); stop(pool); }
    }

    @Test
    void concurrentRegistrationIsIncludedInAccountDeletion() throws Exception {
        CountDownLatch exchanged = new CountDownLatch(1), release = new CountDownLatch(1);
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        String remoteId = "register-" + UUID.randomUUID();
        server.expect(requestTo(SETTINGS.baseUrl() + "/item/public_token/exchange")).andRespond(request -> {
            exchanged.countDown(); await(release);
            return withSuccess("{\"item_id\":\"" + remoteId + "\",\"access_token\":\"access-sandbox-register\"}",
                    MediaType.APPLICATION_JSON).createResponse(request);
        });
        var service = service(builder.build());
        var pool = Executors.newFixedThreadPool(2);
        try {
            var registration = pool.submit(() -> new TransactionTemplate(manager)
                    .execute(s -> service.exchangePublicToken(auth, "public-token")));
            assertTrue(exchanged.await(10, TimeUnit.SECONDS));
            var deletion = pool.submit(() -> users.deleteAccount(user.getId(), auth));
            assertThrows(TimeoutException.class, () -> deletion.get(200, TimeUnit.MILLISECONDS));
            release.countDown();
            PlaidItem registered = registration.get(10, TimeUnit.SECONDS);
            jobIds.add(registered.getId());
            deletion.get(10, TimeUnit.SECONDS);
            assertFalse(userRepository.existsById(user.getId()));
            assertFalse(items.existsById(registered.getId()));
            assertEquals("access-sandbox-register", encryption.decrypt((String) row(registered).get("access_token_encrypted")));
            server.verify();
        } finally { release.countDown(); stop(pool); }
    }

    @Test
    void registrationAfterAccountDeletionDoesNotIssueRemoteCredential() {
        users.deleteAccount(user.getId(), auth);
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = service(builder.build());
        var error = assertThrows(ResponseStatusException.class, () -> new TransactionTemplate(manager)
                .execute(s -> service.exchangePublicToken(auth, "public-token")));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        server.verify();
    }

    @Test
    void foreignItemCannotBeDisconnectedOrQueued() {
        PlaidItem item = item("access-sandbox-owner-only");
        User other = createUser("revoke-other-" + UUID.randomUUID() + "@example.com", "Password123!", "other");
        try {
            var error = assertThrows(ResponseStatusException.class, () -> plaid.disconnectItem(
                    new AuthenticatedUser(other.getId(), other.getEmail(), 0L), item.getId()));
            assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
            assertTrue(items.existsById(item.getId()));
            assertEquals(0, count(item));
        } finally { userRepository.deleteById(other.getId()); }
    }

    @Test
    void concurrentDisconnectRequestsAcceptOnlyOneCleanupJob() throws Exception {
        PlaidItem item = item("access-sandbox-repeat");
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> disconnect = () -> {
            await(start);
            try { plaid.disconnectItem(auth, item.getId()); return 200; }
            catch (ResponseStatusException ex) { return ex.getStatusCode().value(); }
        };
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(disconnect);
            var b = pool.submit(disconnect);
            start.countDown();
            assertEquals(Set.of(200, 404), Set.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS)));
            assertEquals(1, count(item));
            assertFalse(items.existsById(item.getId()));
        } finally { start.countDown(); stop(pool); }
    }

    @Test
    void executorRejectionPersistsRetryAndReleasesLocalWorkerSlot() {
        PlaidItem item = item("access-sandbox-rejected-execution");
        plaid.disconnectItem(auth, item.getId());
        var builder = RestClient.builder().baseUrl(SETTINGS.baseUrl());
        var server = MockRestServiceServer.bindTo(builder).build();
        var worker = new PlaidRevocationWorker(jobs, new PlaidRevocationClient(builder.build(), SETTINGS, encryption),
                task -> { throw new org.springframework.core.task.TaskRejectedException("capacity exhausted"); });
        worker.processOne();
        assertEquals("EXECUTOR_REJECTED", row(item).get("last_error_code"));
        assertNull(row(item).get("lease_owner"));
        assertTrue(jobs.claimNext().isEmpty());
        due(item);
        worker.processOne();
        assertEquals(2, row(item).get("attempt_count"));
        assertEquals(item.getAccessTokenEncrypted(), row(item).get("access_token_encrypted"));
        server.verify();
    }

    private PlaidItem item(String token) {
        PlaidItem item = new PlaidItem();
        item.setUser(user); item.setItemId("remote-" + UUID.randomUUID());
        item.setAccessTokenEncrypted(encryption.encrypt(token)); item.setInstitutionName("Private bank");
        item = items.saveAndFlush(item); jobIds.add(item.getId());
        return item;
    }

    private Map<String, Object> row(PlaidItem item) {
        return jdbc.queryForMap("SELECT * FROM plaid_revocation_jobs WHERE id=?", item.getId());
    }

    private int count(PlaidItem item) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM plaid_revocation_jobs WHERE id=?", Integer.class, item.getId());
    }

    private void due(PlaidItem item) {
        jdbc.update("UPDATE plaid_revocation_jobs SET next_attempt_at=NOW() - INTERVAL '1 second' WHERE id=?", item.getId());
    }

    private PlaidRevocationWorker worker(RestClient client, PlaidRevocationJobService service) {
        return new PlaidRevocationWorker(service, new PlaidRevocationClient(client, SETTINGS, encryption), Runnable::run);
    }

    private PlaidService service(RestClient client) {
        return new PlaidService(client, SETTINGS, encryption, items, userRepository, ingest, cache,
                transfers, Optional.of(manager), jobs);
    }

    private static void await(CountDownLatch latch) {
        try { assertTrue(latch.await(10, TimeUnit.SECONDS)); }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new AssertionError(ex); }
    }

    private static void stop(ExecutorService pool) throws InterruptedException {
        pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
    }
}
