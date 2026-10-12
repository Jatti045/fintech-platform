package com.fintechapp.fintech_api.model;
import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="pending_classification_handoffs", uniqueConstraints=@UniqueConstraint(columnNames={"user_id","item_id","account_id","pending_id"}))
@Getter @Setter @NoArgsConstructor
public class PendingClassificationHandoff {
    @Id private String id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="user_id") private User user;
    @Column(nullable=false) private String itemId;
    @Column(nullable=false) private String accountId;
    @Column(nullable=false) private String pendingId;
    @Column(nullable=false,columnDefinition="TEXT") private String choicesJson;
    @Column(nullable=false) private Instant createdAt;
}
