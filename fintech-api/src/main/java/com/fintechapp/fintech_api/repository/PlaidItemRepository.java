package com.fintechapp.fintech_api.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

@Repository
public interface PlaidItemRepository extends JpaRepository<PlaidItem, String> {

        Optional<PlaidItem> findByItemId(String itemId);

        /**
         * Loads the item with an exclusive row lock ({@code SELECT ... FOR UPDATE}),
         * serializing /transactions/sync page processing across application
         * instances and guaranteeing the freshest committed cursor is read. Must be
         * called from within a transaction.
         */
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select i from PlaidItem i where i.itemId = :itemId")
        Optional<PlaidItem> findByItemIdForUpdate(@Param("itemId") String itemId);

        Optional<PlaidItem> findByIdAndUser_Id(String id, String userId);

        /** Active (non-deleted) items for a user, newest connection first. */
        List<PlaidItem> findByUser_IdOrderByCreatedAtDesc(String userId);

        long deleteByUser_Id(String userId);

        // Health writers own only these columns. Never merge a PlaidItem snapshot:
        // its cursor and lease may have changed since it was read.
        @Transactional
        @Modifying(clearAutomatically = true)
        @Query("""
                            update PlaidItem i
                            set i.status = :status, i.reauthRequestedAt = :requestedAt, i.updatedAt = :requestedAt
                            where i.itemId = :itemId
                        """)
        int markRequiresReauth(@Param("itemId") String itemId,
                        @Param("status") PlaidItemStatus status, @Param("requestedAt") Instant requestedAt);

        @Transactional
        @Modifying(clearAutomatically = true)
        @Query("""
                            update PlaidItem i
                            set i.status = :activeStatus, i.reauthRequestedAt = null, i.updatedAt = :updatedAt
                            where i.itemId = :itemId and i.status = :requiredStatus
                        """)
        int clearRequiresReauth(@Param("itemId") String itemId,
                        @Param("activeStatus") PlaidItemStatus activeStatus,
                        @Param("requiredStatus") PlaidItemStatus requiredStatus, @Param("updatedAt") Instant updatedAt);

        @Transactional
        @Modifying(clearAutomatically = true)
        @Query("""
                            update PlaidItem i
                            set i.status = :activeStatus, i.reauthRequestedAt = null, i.updatedAt = :updatedAt
                            where i.id = :id and i.user.id = :userId
                        """)
        int completeReauth(@Param("id") String id, @Param("userId") String userId,
                        @Param("activeStatus") PlaidItemStatus activeStatus, @Param("updatedAt") Instant updatedAt);

        @Transactional
        @Modifying(clearAutomatically = true)
        @Query("""
                            update PlaidItem i
                            set i.syncError = :syncError, i.updatedAt = :updatedAt
                            where i.itemId = :itemId and i.syncError <> :syncError
                        """)
        int updateSyncError(@Param("itemId") String itemId,
                        @Param("syncError") boolean syncError, @Param("updatedAt") Instant updatedAt);

        /**
         * Attempts to atomically acquire or renew a distributed sync lease for the
         * item.
         * Succeeds if the lease is currently unheld, expired, or already owned by the
         * given token.
         */
        @Modifying
        @Query("""
                            update PlaidItem i
                            set i.syncLockToken = :token, i.syncLockExpiresAt = :expiresAt
                            where i.itemId = :itemId
                              and (i.syncLockExpiresAt is null or i.syncLockExpiresAt <= :now or i.syncLockToken = :token)
                        """)
        int acquireSyncLock(
                        @Param("itemId") String itemId,
                        @Param("token") String token,
                        @Param("expiresAt") Instant expiresAt,
                        @Param("now") Instant now);

        /**
         * Releases the distributed sync lease if and only if the stored token matches
         * the caller's token (preventing accidental release of an expired lease
         * acquired by another instance).
         */
        @Modifying
        @Query("""
                            update PlaidItem i
                            set i.syncLockToken = null, i.syncLockExpiresAt = null
                            where i.itemId = :itemId
                              and i.syncLockToken = :token
                        """)
        int releaseSyncLock(
                        @Param("itemId") String itemId,
                        @Param("token") String token);

        /**
         * Extends an active distributed sync lease if the stored token matches.
         */
        @Modifying
        @Query("""
                            update PlaidItem i
                            set i.syncLockExpiresAt = :expiresAt
                            where i.itemId = :itemId
                              and i.syncLockToken = :token and i.syncLockExpiresAt > :now
                        """)
        int extendSyncLock(
                        @Param("itemId") String itemId,
                        @Param("token") String token,
                        @Param("expiresAt") Instant expiresAt,
                        @Param("now") Instant now);
}
