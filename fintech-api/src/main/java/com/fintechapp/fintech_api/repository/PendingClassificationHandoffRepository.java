package com.fintechapp.fintech_api.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.fintechapp.fintech_api.model.PendingClassificationHandoff;
public interface PendingClassificationHandoffRepository extends JpaRepository<PendingClassificationHandoff,String> {
    Optional<PendingClassificationHandoff> findByUser_IdAndItemIdAndAccountIdAndPendingId(String userId,String itemId,String accountId,String pendingId);
    long deleteByUser_Id(String userId);
}
