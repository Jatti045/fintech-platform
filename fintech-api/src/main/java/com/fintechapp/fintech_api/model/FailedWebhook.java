package com.fintechapp.fintech_api.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Dead-letter queue for Plaid webhook payloads that could not be processed.
 *
 * <p>The webhook endpoint always acknowledges Plaid with HTTP 200 (so it never
 * retries and we avoid retry storms), but every unprocessable payload is saved
 * here with the resulting error so an operator can inspect and replay it.</p>
 */
@Entity
@Table(name = "failed_webhooks")
@Getter
@Setter
@NoArgsConstructor
public class FailedWebhook {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "item_id", length = 128)
    private String itemId;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Column(name = "error_type", length = 255)
    private String errorType;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "stack_trace", columnDefinition = "TEXT")
    private String stackTrace;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt = Instant.now();
}