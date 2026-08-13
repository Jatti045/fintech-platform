package com.fintechapp.fintech_api.model;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.UpdateTimestamp;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Index;

@Entity
@Table(name = "budgets", indexes = {
        @Index(name = "idx_budgets_user_date", columnList = "user_id,date"),
        @Index(name = "idx_budgets_user_category", columnList = "user_id,category")
})
@Getter
@Setter
@NoArgsConstructor
public class Budget {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false)
    private Instant date;

    @Column(nullable = false)
    private String category;

    @Column(name = "budget_limit", nullable = false)
    private double limit;

    @Column(nullable = false)
    private double spent = 0;

    /**
     * True when this category was auto-created by Plaid transaction ingestion
     * with a {@code $0} limit. Users should review these and assign a limit
     * (setting a limit clears the flag).
     */
    @Column(name = "is_auto_created", nullable = false)
    private boolean autoCreated = false;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToMany(mappedBy = "budget")
    private Set<Transaction> transactions = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
