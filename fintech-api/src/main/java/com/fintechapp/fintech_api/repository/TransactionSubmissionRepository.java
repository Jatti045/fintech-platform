package com.fintechapp.fintech_api.repository;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.fintechapp.fintech_api.dto.transaction.TransactionDataResponse;
import com.fintechapp.fintech_api.model.TransactionType;

import tools.jackson.databind.ObjectMapper;

@Repository
public class TransactionSubmissionRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public TransactionSubmissionRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public record SubmittedTransaction(String fingerprint, String responseJson) {}

    private record CreationInput(String name, Instant date, String category, TransactionType type,
            double originalAmount, String requestedCurrency, String budgetId, String description) {}

    public String fingerprint(String name, Instant date, String category, TransactionType type,
            double originalAmount, String requestedCurrency, String budgetId, String description) {
        var input = new CreationInput(name, date, category, type, originalAmount, requestedCurrency, budgetId,
                description);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsBytes(input)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    public Optional<SubmittedTransaction> find(String userId, UUID submissionId) {
        return jdbc.query("""
                SELECT request_fingerprint, response_json FROM transaction_submissions
                WHERE user_id = ? AND submission_id = ?
                """, (rs, row) -> new SubmittedTransaction(rs.getString(1), rs.getString(2)),
                userId, submissionId).stream().findFirst();
    }

    public TransactionDataResponse response(SubmittedTransaction submission) {
        return mapper.readValue(submission.responseJson(), TransactionDataResponse.class);
    }

    public void save(String userId, UUID submissionId, String fingerprint, TransactionDataResponse response) {
        jdbc.update("""
                INSERT INTO transaction_submissions (user_id, submission_id, request_fingerprint, response_json)
                VALUES (?, ?, ?, ?)
                """, userId, submissionId, fingerprint, mapper.writeValueAsString(response));
    }
}
