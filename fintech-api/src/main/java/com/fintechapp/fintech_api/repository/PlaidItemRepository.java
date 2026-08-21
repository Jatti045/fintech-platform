package com.fintechapp.fintech_api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.fintechapp.fintech_api.model.PlaidItem;
import org.springframework.stereotype.Repository;

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
}
