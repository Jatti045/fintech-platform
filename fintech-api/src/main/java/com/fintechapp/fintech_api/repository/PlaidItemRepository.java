package com.fintechapp.fintech_api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fintechapp.fintech_api.model.PlaidItem;
import org.springframework.stereotype.Repository;

@Repository
public interface PlaidItemRepository extends JpaRepository<PlaidItem, String> {

    Optional<PlaidItem> findByItemId(String itemId);

    Optional<PlaidItem> findByIdAndUser_Id(String id, String userId);

    /** Active (non-deleted) items for a user, newest connection first. */
    List<PlaidItem> findByUser_IdOrderByCreatedAtDesc(String userId);

    long deleteByUser_Id(String userId);
}
