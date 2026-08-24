package com.fintechapp.fintech_api.model;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = true)
    private String password;

    @Column(name = "auth_provider", nullable = false)
    @Enumerated(EnumType.STRING)
    private AuthProvider authProvider;

    @Column(nullable = false)
    private String username;

    @Column(name = "profile_pic")
    private String profilePic;

    @Column(name = "profile_pic_public_id")
    private String profilePicPublicId;

    @Column(nullable = false)
    private String currency = "USD";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "user")
    private Set<Transaction> transactions = new HashSet<>();

    @OneToMany(mappedBy = "user")
    private Set<Budget> budgets = new HashSet<>();

    @OneToMany(mappedBy = "user")
    private Set<PasswordResetToken> passwordResets = new HashSet<>();

    @OneToMany(mappedBy = "user")
    private Set<UserMonthlyIncome> monthlyIncomes = new HashSet<>();
}
