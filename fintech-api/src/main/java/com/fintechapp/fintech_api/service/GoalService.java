package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.goal.AllocateGoalRequest;
import com.fintechapp.fintech_api.dto.goal.CreateGoalRequest;
import com.fintechapp.fintech_api.dto.goal.GoalDataResponse;
import com.fintechapp.fintech_api.dto.goal.GoalIdResponse;
import com.fintechapp.fintech_api.dto.goal.GoalItemResponse;
import com.fintechapp.fintech_api.dto.goal.GoalsResponse;
import com.fintechapp.fintech_api.dto.goal.UpdateGoalRequest;
import com.fintechapp.fintech_api.model.Goal;
import com.fintechapp.fintech_api.model.GoalAllocation;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.GoalAllocationRepository;
import com.fintechapp.fintech_api.repository.GoalRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@Service
public class GoalService {

    private final GoalRepository goalRepository;
    private final GoalAllocationRepository goalAllocationRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public GoalService(
            GoalRepository goalRepository,
            GoalAllocationRepository goalAllocationRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository) {
        this.goalRepository = goalRepository;
        this.goalAllocationRepository = goalAllocationRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public GoalsResponse getGoals(AuthenticatedUser authenticatedUser, String monthRaw, String yearRaw) {
        String userId = requireUserId(authenticatedUser);

        if (monthRaw == null || yearRaw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month and year query parameters are required");
        }

        Integer month = parseInteger(monthRaw);
        Integer year = parseInteger(yearRaw);
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        List<GoalItemResponse> goals = goalRepository.findByUser_IdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByUpdatedAtDesc(userId, monthStart, nextMonthStart)
                .stream()
                .map(this::toGoalItem)
                .toList();

        return new GoalsResponse(true, "Goals retrieved successfully", goals);
    }

    @Transactional
    public GoalDataResponse createGoal(AuthenticatedUser authenticatedUser, CreateGoalRequest request) {
        String userId = requireUserId(authenticatedUser);

        if (request == null
                || !StringUtils.hasText(request.name())
                || request.target() == null
                || request.target() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "name and target are required, and target must be a positive number");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));

        Goal goal = new Goal();
        goal.setUser(user);
        goal.setName(request.name().trim());
        goal.setTarget(request.target());
        goal.setProgress(0);
        goal.setIcon(normalizeOptional(request.icon()));

        Goal saved = goalRepository.save(goal);
        return new GoalDataResponse(true, "Goal created successfully", toGoalItem(saved));
    }

    @Transactional
    public GoalDataResponse updateGoal(
            AuthenticatedUser authenticatedUser,
            String goalId,
            UpdateGoalRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(goalId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "goalId is required");
        }

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No update payload provided");
        }

        Goal existing = goalRepository.findByIdAndUser_Id(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Goal not found or doesn't belong to user"));

        if (request.name() != null) {
            String nextName = normalizeOptional(request.name());
            if (!StringUtils.hasText(nextName)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goal name cannot be empty");
            }
            existing.setName(nextName);
        }

        if (request.target() != null) {
            if (request.target() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target must be a positive number");
            }
            if (request.target() < existing.getProgress()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Target cannot be less than current allocated amount");
            }
            existing.setTarget(request.target());
        }

        if (request.icon() != null) {
            existing.setIcon(normalizeOptional(request.icon()));
        }

        Goal updated = goalRepository.save(existing);
        return new GoalDataResponse(true, "Goal updated successfully", toGoalItem(updated));
    }

    @Transactional
    public GoalDataResponse allocateToGoal(
            AuthenticatedUser authenticatedUser,
            String goalId,
            AllocateGoalRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(goalId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "goalId is required");
        }

        if (request == null || request.amount() == null || request.amount() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be a positive number");
        }

        Goal existing = goalRepository.findByIdAndUser_Id(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Goal not found or doesn't belong to user"));

        double nextProgress = existing.getProgress() + request.amount();
        existing.setProgress(Math.min(nextProgress, existing.getTarget()));

        GoalAllocation allocation = new GoalAllocation();
        allocation.setUser(existing.getUser());
        allocation.setGoal(existing);
        allocation.setAmount(request.amount());
        allocation.setAllocatedAt(Instant.now());
        goalAllocationRepository.save(allocation);

        Goal updated = goalRepository.save(existing);
        return new GoalDataResponse(true, "Allocation added successfully", toGoalItem(updated));
    }

    @Transactional
    public GoalDataResponse deallocateFromGoal(
            AuthenticatedUser authenticatedUser,
            String goalId,
            AllocateGoalRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(goalId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "goalId is required");
        }

        if (request == null || request.amount() == null || request.amount() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be a positive number");
        }

        Goal existing = goalRepository.findByIdAndUser_Id(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Goal not found or doesn't belong to user"));

        if (request.amount() > existing.getProgress()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Deallocation amount cannot exceed current goal progress");
        }

        existing.setProgress(existing.getProgress() - request.amount());

        GoalAllocation allocation = new GoalAllocation();
        allocation.setUser(existing.getUser());
        allocation.setGoal(existing);
        allocation.setAmount(-request.amount());
        allocation.setAllocatedAt(Instant.now());
        goalAllocationRepository.save(allocation);

        Goal updated = goalRepository.save(existing);
        return new GoalDataResponse(true, "Deallocation added successfully", toGoalItem(updated));
    }

    @Transactional
    public GoalIdResponse deleteGoal(AuthenticatedUser authenticatedUser, String goalId) {
        String userId = requireUserId(authenticatedUser);

        Goal goal = goalRepository.findByIdAndUser_Id(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found"));

        long attachedCount = transactionRepository.countByGoal_IdAndUser_Id(goalId, userId);
        if (attachedCount > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot delete goal: there are transactions attached to this goal. Remove or reassign those transactions first.");
        }

        goalAllocationRepository.deleteByGoal_IdAndUser_Id(goalId, userId);
        goalRepository.delete(goal);
        return new GoalIdResponse(true, "Goal deleted successfully", goalId);
    }

    private GoalItemResponse toGoalItem(Goal goal) {
        double remaining = Math.max(0, goal.getTarget() - goal.getProgress());
        boolean achieved = goal.getProgress() >= goal.getTarget();

        return new GoalItemResponse(
                goal.getId(),
                goal.getUser().getId(),
                goal.getName(),
                goal.getTarget(),
                goal.getProgress(),
                remaining,
                achieved,
                goal.getIcon(),
                goal.getCreatedAt(),
                goal.getUpdatedAt());
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return authenticatedUser.userId();
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private Integer parseInteger(String rawValue) {
        try {
            return Integer.parseInt(rawValue);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Instant monthStart(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1)
                .plusMonths(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);
    }
}
