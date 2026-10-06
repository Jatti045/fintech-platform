package com.fintechapp.fintech_api.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.fintechapp.fintech_api.model.UserMonthlyIncome;

@Repository
public interface UserMonthlyIncomeRepository extends JpaRepository<UserMonthlyIncome, String> {

    Optional<UserMonthlyIncome> findByUser_IdAndMonthStart(String userId, Instant monthStart);

    Optional<UserMonthlyIncome> findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(
            String userId,
            Instant monthStart);

    boolean existsByUser_Id(String userId);

    long deleteByUser_Id(String userId);
}

