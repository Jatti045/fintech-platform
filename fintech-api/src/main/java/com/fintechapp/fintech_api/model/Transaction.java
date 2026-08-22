package com.fintechapp.fintech_api.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.UpdateTimestamp;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;

@Entity
@Table(name = "transactions", indexes = {
        @Index(name = "idx_transactions_user_date", columnList = "user_id,transaction_date"),
        @Index(name = "idx_transactions_budget", columnList = "budget_id"),
        @Index(name = "idx_transactions_goal", columnList = "goal_id"),
        @Index(name = "idx_transactions_type", columnList = "type"),
        @Index(name = "uq_transactions_plaid_id", columnList = "plaid_transaction_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "transaction_date", nullable = false)
    private Instant date;

    @Column(nullable = false)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Column(nullable = false)
    private double amount;

    @Column(name = "base_currency")
    private String baseCurrency;

    @Column(name = "original_amount")
    private Double originalAmount;

    @Column(name = "original_currency")
    private String originalCurrency;

    @Column(name = "plaid_transaction_id", length = 128)
    private String plaidTransactionId;

    /**
     * Plaid's structured {@code account_id} for the account this transaction
     * belongs to. Persisted so the application can later establish which
     * accounts belong to the same user at the same institution.
     */
    @Column(name = "plaid_account_id", length = 128)
    private String plaidAccountId;

    /**
     * The Plaid item (financial institution connection) this transaction was
     * synchronized from. Persisted so account ownership can be proven against
     * the user's own Plaid items.
     */
    @Column(name = "plaid_item_id", length = 128)
    private String plaidItemId;

    /**
     * Plaid's {@code personal_finance_category.detailed} code (falling back to
     * {@code subcategory}). Persisted because {@code category} keeps only the
     * coarse {@code primary} code (e.g. {@code TRANSFER_OUT}), which is shared
     * by genuine internal transfers and P2P apps (Cash App/Venmo). Only the
     * detailed code distinguishes {@code TRANSFER_OUT_ACCOUNT_TRANSFER} from
     * {@code TRANSFER_OUT_THIRD_PARTY_P2P}.
     */
    @Column(name = "plaid_pfc_detailed", length = 128)
    private String plaidPfcDetailed;

    /**
     * True when this transaction is a transfer of money between the user's own
     * accounts (movement of existing money). Such transactions stay in the
     * history but must never contribute to income or expense analytics.
     */
    @Column(name = "is_transfer", nullable = false, columnDefinition = "boolean not null default false")
    private boolean transfer;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "budget_id")
    private Budget budget;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    private Goal goal;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
