package com.fintechapp.fintech_api.repository;
import com.fintechapp.fintech_api.model.CategorizationRule;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CategorizationRuleRepository extends JpaRepository<CategorizationRule, String> {
    java.util.Optional<CategorizationRule> findByIdAndUser_Id(String id, String userId);
    long deleteByUser_Id(String userId);
    java.util.List<CategorizationRule> findByUser_IdOrderByPriorityAscCreatedAtAscIdAsc(String userId);
}
