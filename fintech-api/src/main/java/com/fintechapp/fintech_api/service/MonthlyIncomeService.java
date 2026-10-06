package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.model.UserMonthlyIncome;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@Service
public class MonthlyIncomeService {

    private final UserMonthlyIncomeRepository userMonthlyIncomeRepository;

    private final UserRepository userRepository;

    public MonthlyIncomeService(UserMonthlyIncomeRepository userMonthlyIncomeRepository, UserRepository userRepository) {
        this.userMonthlyIncomeRepository = userMonthlyIncomeRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public double resolveForMonth(User user, int year, int month) {
        Instant targetMonthStart = monthStart(year, month);
        return userMonthlyIncomeRepository
                .findTopByUser_IdAndMonthStartLessThanEqualOrderByMonthStartDesc(user.getId(), targetMonthStart)
                .map(UserMonthlyIncome::getIncome)
                .orElse(0d);
    }

    @Transactional(readOnly = true)
    public double resolveForCurrentMonth(User user) {
        LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);
        return resolveForMonth(user, utcNow.getYear(), utcNow.getMonthValue() - 1);
    }

    @Transactional
    public void upsertForMonth(User user, int year, int month, double income) {
        Instant targetMonthStart = monthStart(year, month);
        // Serialize every income write with currency changes, including direct callers.
        User lockedUser = userRepository.findByIdForUpdate(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        UserMonthlyIncome monthlyIncome = userMonthlyIncomeRepository
                .findByUser_IdAndMonthStart(user.getId(), targetMonthStart)
                .orElseGet(() -> {
                    UserMonthlyIncome created = new UserMonthlyIncome();
                    created.setUser(lockedUser);
                    created.setMonthStart(targetMonthStart);
                    return created;
                });

        monthlyIncome.setIncome(income);
        userMonthlyIncomeRepository.save(monthlyIncome);
    }

    @Transactional(readOnly = true)
    public boolean existsForUser(String userId) {
        return userMonthlyIncomeRepository.existsByUser_Id(userId);
    }

    @Transactional
    public void deleteByUserId(String userId) {
        userMonthlyIncomeRepository.deleteByUser_Id(userId);
    }

    public Instant monthStart(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}


