package com.fintechapp.fintech_api.integration.service;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.*;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.security.JwtService;
import com.fintechapp.fintech_api.security.TokenAuthenticationException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Each service call uses its own committed transaction, with real overlapping requests. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class UserUpdateConcurrencyIntegrationTest extends BaseIntegrationTest {
    @Autowired UserService users;
    @Autowired AiPrivacyService privacy;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager manager;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CloudinaryService cloud;
    @MockitoBean FinancialCacheInvalidator cache;
    private User actor;
    private AuthenticatedUser auth;

    @BeforeEach void prepare() {
        actor = createUser("user-race-" + UUID.randomUUID() + "@example.com", "Password123!", "profile-owner");
        actor.setProfilePic("https://example.com/old.png"); actor.setProfilePicPublicId("old-asset");
        actor = userRepository.saveAndFlush(actor);
        auth = new AuthenticatedUser(actor.getId(), actor.getEmail(), Instant.now().getEpochSecond(), actor.getSessionVersion());
        doAnswer(inv -> { assertNoTransaction(); return null; }).when(cloud).deleteImage(any());
    }
    @AfterEach void cleanup() {
        if (userRepository.existsById(actor.getId())) userRepository.deleteById(actor.getId());
    }
    private static void assertNoTransaction() {
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "Cloudinary must not hold a database transaction");
    }
    private static void await(CountDownLatch signal) throws InterruptedException {
        assertTrue(signal.await(10, TimeUnit.SECONDS));
    }
    private MockMultipartFile file(String name) {
        return new MockMultipartFile("profilePicture", name, "image/png", new byte[]{1, 2, 3});
    }
    private User current() { return userRepository.findById(actor.getId()).orElseThrow(); }
    private void withBlockedUpload(Runnable concurrentChange, Consumer<ProfilePictureUploadResponse> after) throws Exception {
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction(); entered.countDown(); await(release);
            return new CloudinaryService.UploadedImage("https://example.com/new.png", "new-asset");
        });
        var pool = Executors.newFixedThreadPool(2);
        try {
            var uploading = pool.submit(() -> users.uploadProfilePicture(actor.getId(), file("new.png"), auth));
            await(entered);
            // Must finish while upload is blocked: it cannot share a long-running user lock.
            pool.submit(concurrentChange).get(5, TimeUnit.SECONDS);
            release.countDown();
            after.accept(uploading.get(10, TimeUnit.SECONDS));
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void uploadCannotReverseAConcurrentPasswordChangeOrSessionRevocation() throws Exception {
        String oldToken = jwt.generateToken(actor.getId(), actor.getEmail(), actor.getSessionVersion());
        withBlockedUpload(() -> users.changePassword(auth,
                new ChangePasswordRequest("Password123!", "NewPassword123!", "NewPassword123!")), response -> {
            User saved = current();
            assertTrue(passwordEncoder.matches("NewPassword123!", saved.getPassword()));
            assertEquals(1, saved.getSessionVersion()); assertEquals("new-asset", saved.getProfilePicPublicId());
            assertEquals("https://example.com/new.png", response.data().profilePic());
            assertThrows(TokenAuthenticationException.class, () -> jwt.authenticate(oldToken));
        });
        verify(cloud).deleteImage("old-asset");
    }
    @Test void uploadCannotReverseConsentWithdrawalOrACurrencyChange() throws Exception {
        privacy.update(auth, new UpdateAiPrivacyRequest(true, "1"));
        withBlockedUpload(() -> {
            privacy.update(auth, new UpdateAiPrivacyRequest(false, null));
            users.updateCurrency(auth, new UpdateCurrencyRequest("EUR"));
        }, response -> {
            User saved = current();
            assertFalse(saved.isAiProcessingEnabled()); assertEquals("1", saved.getAiConsentVersion());
            assertNotNull(saved.getAiConsentUpdatedAt()); assertEquals("EUR", saved.getCurrency());
            assertEquals("profile-owner", saved.getUsername()); assertEquals(actor.getEmail(), saved.getEmail());
            assertEquals("new-asset", saved.getProfilePicPublicId());
            assertFalse(privacy.get(auth).data().enabled());
        });
    }
    @Test void concurrentUploadsReplaceTheLatestAssetAndCleanUpEachSupersededPicture() throws Exception {
        var firstEntered = new CountDownLatch(1); var secondEntered = new CountDownLatch(1);
        var firstRelease = new CountDownLatch(1); var secondRelease = new CountDownLatch(1);
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction();
            String name = ((org.springframework.web.multipart.MultipartFile) inv.getArgument(0)).getOriginalFilename();
            if ("first.png".equals(name)) { firstEntered.countDown(); await(firstRelease); }
            else { secondEntered.countDown(); await(secondRelease); }
            return new CloudinaryService.UploadedImage("https://example.com/" + name, name + "-asset");
        });
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> users.uploadProfilePicture(actor.getId(), file("first.png"), auth)); await(firstEntered);
            var second = pool.submit(() -> users.uploadProfilePicture(actor.getId(), file("second.png"), auth)); await(secondEntered);
            firstRelease.countDown(); first.get(10, TimeUnit.SECONDS);
            secondRelease.countDown(); second.get(10, TimeUnit.SECONDS);
            assertEquals("second.png-asset", current().getProfilePicPublicId());
            verify(cloud).deleteImage("old-asset"); verify(cloud).deleteImage("first.png-asset");
            verify(cloud, never()).deleteImage("second.png-asset");
        } finally { firstRelease.countDown(); secondRelease.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void deletionDuringAnUploadDoesNotDeleteTheNewPicture() throws Exception {
        withBlockedUpload(() -> {
            users.deleteProfilePicture(actor.getId(), auth);
            assertNull(current().getProfilePic());
        }, response -> assertEquals("new-asset", current().getProfilePicPublicId()));
        verify(cloud, times(1)).deleteImage("old-asset");
        verify(cloud, never()).deleteImage("new-asset");
    }
    @Test void cleanupOnlyRunsAfterThePictureRemovalHasCommitted() {
        privacy.update(auth, new UpdateAiPrivacyRequest(true, "1"));
        privacy.update(auth, new UpdateAiPrivacyRequest(false, null));
        doAnswer(inv -> {
            assertNoTransaction();
            assertNull(current().getProfilePic()); assertNull(current().getProfilePicPublicId());
            assertFalse(current().isAiProcessingEnabled());
            return null;
        }).when(cloud).deleteImage("old-asset");
        var response = users.deleteProfilePicture(actor.getId(), auth);
        assertNull(response.data().profilePic()); verify(cloud).deleteImage("old-asset");
    }
    @Test void databaseFailureCleansUpTheNewUploadAndPreservesThePreviousPicture() {
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction();
            return new CloudinaryService.UploadedImage("https://example.com/" + "x".repeat(300), "failed-asset");
        });
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> users.uploadProfilePicture(actor.getId(), file("failure.png"), auth));
        assertEquals("old-asset", current().getProfilePicPublicId());
        verify(cloud).deleteImage("failed-asset"); verify(cloud, never()).deleteImage("old-asset");
    }
    @Test void externalUploadFailureLeavesAllAccountFieldsUntouched() {
        long version = current().getUpdateVersion();
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction(); throw new IllegalStateException("Cloud unavailable");
        });
        assertThrows(IllegalStateException.class, () -> users.uploadProfilePicture(actor.getId(), file("failure.png"), auth));
        assertEquals(version, current().getUpdateVersion()); assertEquals("old-asset", current().getProfilePicPublicId());
        verify(cloud, never()).deleteImage(any());
    }
    @Test void anAccountDeletedDuringUploadIsNotRecreatedAndTheNewAssetIsRemoved() throws Exception {
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction(); entered.countDown(); await(release);
            return new CloudinaryService.UploadedImage("https://example.com/new.png", "new-asset");
        });
        var pool = Executors.newSingleThreadExecutor();
        try {
            var upload = pool.submit(() -> users.uploadProfilePicture(actor.getId(), file("new.png"), auth)); await(entered);
            users.deleteAccount(actor.getId(), auth); release.countDown();
            var failure = assertThrows(ExecutionException.class, () -> upload.get(10, TimeUnit.SECONDS));
            assertEquals(404, ((org.springframework.web.server.ResponseStatusException) failure.getCause()).getStatusCode().value());
            assertFalse(userRepository.existsById(actor.getId())); verify(cloud).deleteImage("new-asset");
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void surroundingTransactionsAreSuspendedForCloudOperations() {
        when(cloud.uploadProfileImage(any(), eq(actor.getId()))).thenAnswer(inv -> {
            assertNoTransaction(); return new CloudinaryService.UploadedImage("https://example.com/new.png", "new-asset");
        });
        new TransactionTemplate(manager).execute(status -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            users.uploadProfilePicture(actor.getId(), file("new.png"), auth);
            users.deleteProfilePicture(actor.getId(), auth);
            return null;
        });
        verify(cloud).deleteImage("old-asset"); verify(cloud).deleteImage("new-asset");
    }
    @Test void aStaleManagedWriterFailsInsteadOfUndoingConsentWithdrawal() throws Exception {
        privacy.update(auth, new UpdateAiPrivacyRequest(true, "1"));
        var read = new CountDownLatch(1); var write = new CountDownLatch(1);
        var pool = Executors.newSingleThreadExecutor();
        try {
            var staleWrite = pool.submit(() -> new TransactionTemplate(manager).execute(status -> {
                User stale = userRepository.findById(actor.getId()).orElseThrow(); read.countDown();
                try { await(write); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
                stale.setProfilePic("https://example.com/stale.png"); userRepository.saveAndFlush(stale);
                return null;
            }));
            await(read); privacy.update(auth, new UpdateAiPrivacyRequest(false, null)); write.countDown();
            var error = assertThrows(ExecutionException.class, () -> staleWrite.get(10, TimeUnit.SECONDS));
            assertInstanceOf(OptimisticLockingFailureException.class, error.getCause());
            assertFalse(current().isAiProcessingEnabled()); assertEquals("old-asset", current().getProfilePicPublicId());
        } finally { write.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS)); }
    }
    @Test void aStaleDetachedSnapshotCannotRestoreOtherAccountInformation() {
        User stale = current();
        users.updateCurrency(auth, new UpdateCurrencyRequest("CAD"));
        stale.setProfilePic("https://example.com/stale.png");
        assertThrows(OptimisticLockingFailureException.class, () -> userRepository.saveAndFlush(stale));
        assertEquals("CAD", current().getCurrency()); assertEquals("old-asset", current().getProfilePicPublicId());
    }
    @Test void migrationPreservesAccountDataAndExistingVersionValues() throws Exception {
        String schema = "user_updates_" + UUID.randomUUID().toString().replace("-", "");
        String sql;
        try (var resource = getClass().getResourceAsStream("/db/migration/V27__user_update_version.sql")) {
            sql = new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).replace("ALTER TABLE users", "ALTER TABLE " + schema + ".users");
        }
        jdbc.execute("CREATE SCHEMA " + schema);
        try {
            jdbc.execute("CREATE TABLE " + schema + ".users(id TEXT PRIMARY KEY, password TEXT, session_version BIGINT, ai_processing_enabled BOOLEAN)");
            jdbc.execute("INSERT INTO " + schema + ".users VALUES ('legacy','hash',3,FALSE)"); jdbc.execute(sql);
            assertEquals(0, jdbc.queryForObject("SELECT update_version FROM " + schema + ".users", Long.class));
            jdbc.execute("UPDATE " + schema + ".users SET update_version=7"); jdbc.execute(sql);
            assertEquals(7, jdbc.queryForObject("SELECT update_version FROM " + schema + ".users", Long.class));
            assertEquals("hash", jdbc.queryForObject("SELECT password FROM " + schema + ".users", String.class));
            assertEquals(3, jdbc.queryForObject("SELECT session_version FROM " + schema + ".users", Long.class));
            assertFalse(jdbc.queryForObject("SELECT ai_processing_enabled FROM " + schema + ".users", Boolean.class));
        } finally { jdbc.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }
}
