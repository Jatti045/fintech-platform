package com.fintechapp.fintech_api.model;
import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="rule_applications") @Getter @Setter @NoArgsConstructor
public class RuleApplication {
    @Id private String id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="user_id") private User user;
    private String ruleId;
    @Column(columnDefinition="TEXT", nullable=false) private String changesJson;
    @Column(nullable=false) private Instant createdAt;
    private Instant undoneAt;
}
