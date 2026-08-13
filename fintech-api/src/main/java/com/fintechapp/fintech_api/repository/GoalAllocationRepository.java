package com.fintechapp.fintech_api.repository;

import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.fintechapp.fintech_api.model.GoalAllocation;

@Repository
public interface GoalAllocationRepository extends JpaRepository<GoalAllocation, String> {

    @Query("""
            SELECT COALESCE(SUM(ga.amount), 0)
            FROM GoalAllocation ga
            WHERE ga.user.id = :userId
              AND ga.allocatedAt >= :from
              AND ga.allocatedAt < :to
            """)
    double sumAllocatedByUserAndAllocatedAtBetween(
            @Param("userId") String userId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    long deleteByGoal_IdAndUser_Id(String goalId, String userId);

    long deleteByUser_Id(String userId);
}
