package com.fintechapp.fintech_api.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.fintechapp.fintech_api.model.Budget;
import org.springframework.stereotype.Repository;

@Repository
public interface BudgetRepository extends JpaRepository<Budget, String> {

    List<Budget> findByUser_IdOrderByDateDesc(String userId);

    List<Budget> findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
            String userId,
            Instant from,
            Instant to
    );

    Optional<Budget> findByIdAndUser_Id(String id, String userId);

    /**
     * Case-insensitive lookup of a user's budget for the given category within
     * a single month window. Used by Plaid ingestion to match "category" to an
     * existing budget regardless of source casing.
     */
    Optional<Budget> findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
            String userId,
            String category,
            Instant from,
            Instant to);

    boolean existsByUser_IdAndCategoryAndDateGreaterThanEqualAndDateLessThan(
            String userId,
            String category,
            Instant from,
            Instant to
    );

    boolean existsByUser_IdAndCategoryAndDateGreaterThanEqualAndDateLessThanAndIdNot(
            String userId,
            String category,
            Instant from,
            Instant to,
            String excludedId
    );

    long deleteByUser_Id(String userId);
}

