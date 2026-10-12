package com.fintechapp.fintech_api.model;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "categorization_rules", indexes = @Index(name="idx_rules_user_priority", columnList="user_id,priority"))
@Getter @Setter @NoArgsConstructor
public class CategorizationRule {
    @Id private String id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name="user_id") private User user;
    @Column(nullable=false) private String title;
    @Column(nullable=false) private String field;
    @Column(nullable=false) private String matchMode;
    @Column(nullable=false) private String matchText;
    private String direction;
    private String accountId;
    private String providerCategoryCondition;
    private String category;
    private String budgetCategory;
    private String displayName;
    @Column(nullable=false) private int priority;
    @Column(nullable=false) private boolean enabled = true;
    @Column(nullable=false) private long revision = 1;
    @Column(nullable=false, updatable=false) private Instant createdAt;
    @Column(nullable=false) private Instant effectiveAt;
}
