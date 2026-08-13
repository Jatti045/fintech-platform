package com.fintechapp.fintech_api.integration.support;

import java.time.Instant;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.ObjectMapper;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.AuthProvider;
import com.fintechapp.fintech_api.model.Goal;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.model.UserMonthlyIncome;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.GoalRepository;
import com.fintechapp.fintech_api.repository.PasswordResetTokenRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserMonthlyIncomeRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class BaseIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected TestJwtUtil testJwtUtil;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected BudgetRepository budgetRepository;

    @Autowired
    protected GoalRepository goalRepository;

    @Autowired
    protected TransactionRepository transactionRepository;

    @Autowired
    protected UserMonthlyIncomeRepository userMonthlyIncomeRepository;

    @Autowired
    protected PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    protected User createUser(String email, String rawPassword, String username) {
        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setUsername(username);
        user.setAuthProvider(AuthProvider.EMAIL);
        return userRepository.save(user);
    }

    protected Budget createBudget(User user, String category, double limit, Instant date) {
        Budget budget = new Budget();
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimit(limit);
        budget.setDate(date);
        budget.setSpent(0);
        return budgetRepository.save(budget);
    }

    protected Goal createGoal(User user, double target, double progress, String icon) {
        Goal goal = new Goal();
        goal.setUser(user);
        goal.setTarget(target);
        goal.setProgress(progress);
        goal.setIcon(icon);
        return goalRepository.save(goal);
    }

    protected Transaction createTransaction(
            User user,
            Budget budget,
            Goal goal,
            String name,
            Instant date,
            String category,
            TransactionType type,
            double amount
    ) {
        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setBudget(budget);
        transaction.setGoal(goal);
        transaction.setName(name);
        transaction.setDate(date);
        transaction.setCategory(category);
        transaction.setType(type);
        transaction.setAmount(amount);
        return transactionRepository.save(transaction);
    }

    protected UserMonthlyIncome createMonthlyIncome(User user, Instant monthStart, double income) {
        UserMonthlyIncome monthlyIncome = new UserMonthlyIncome();
        monthlyIncome.setUser(user);
        monthlyIncome.setMonthStart(monthStart);
        monthlyIncome.setIncome(income);
        return userMonthlyIncomeRepository.save(monthlyIncome);
    }

    protected String asJson(Object payload) throws Exception {
        return objectMapper.writeValueAsString(payload);
    }

    protected String authHeader(User user) {
        return testJwtUtil.bearerHeaderValue(user);
    }

    protected String authHeaderName() {
        return HttpHeaders.AUTHORIZATION;
    }

    protected MediaType json() {
        return MediaType.APPLICATION_JSON;
    }
}


