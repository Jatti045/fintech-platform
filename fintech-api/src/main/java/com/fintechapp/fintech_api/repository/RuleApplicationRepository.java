package com.fintechapp.fintech_api.repository;
import com.fintechapp.fintech_api.model.RuleApplication;
import org.springframework.data.jpa.repository.JpaRepository;
public interface RuleApplicationRepository extends JpaRepository<RuleApplication, String> {
    java.util.Optional<RuleApplication> findByIdAndUser_Id(String id, String userId);
    java.util.List<RuleApplication> findTop20ByUser_IdOrderByCreatedAtDesc(String userId);
    long deleteByUser_Id(String userId);
}
