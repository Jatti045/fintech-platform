package com.fintechapp.fintech_api.model;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Single-use mailbox proof, scoped to one exact Google subject and account. */
@Entity
@Table(name = "google_identity_challenges")
@Getter @Setter @NoArgsConstructor
public class GoogleIdentityChallenge {
    @Id @Column(length = 255) private String email;
    @Column(name = "google_subject", nullable = false, length = 255) private String googleSubject;
    @Column(name = "token_hash", nullable = false) private String tokenHash;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_user_id")
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private User targetUser;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "failed_attempts", nullable = false) private int failedAttempts;
}
