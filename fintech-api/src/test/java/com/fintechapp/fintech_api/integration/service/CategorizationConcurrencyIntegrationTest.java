package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

@Transactional(propagation=Propagation.NOT_SUPPORTED)
class CategorizationConcurrencyIntegrationTest extends BaseIntegrationTest {
    @Autowired PlaidTransactionIngestService ingest;
    @Autowired CategorizationRuleService rules;
    @Autowired TransactionService edits;
    @Autowired CategorizationRuleRepository ruleRepository;
    @Autowired RuleApplicationRepository applications;
    @Autowired PendingClassificationHandoffRepository handoffs;
    @Autowired PlatformTransactionManager manager;
    @Test void concurrentProviderWritesAndManualChoiceSerializeAcrossCommittedTransactions() throws Exception {
        User u=createUser("concurrent-rules-"+UUID.randomUUID()+"@example.com","Password123!","Concurrency");
        AuthenticatedUser auth=new AuthenticatedUser(u.getId(),u.getEmail(),0);
        var rule=rules.save(auth,null,new RuleRequest("Coffee","MERCHANT","NORMALIZED_EXACT","Starbucks",null,null,null,"Coffee","Food",null,1,true,null));
        Instant date=Instant.parse("2026-10-15T00:00:00Z");
        String plaidId=UUID.randomUUID().toString();
        var initial=new PlaidTransaction(plaidId,"Starbucks",date,"Food",10,false,"USD",null,"account","item","FOOD_AND_DRINK_FAST_FOOD",false,null,LocalDate.of(2026,10,15));
        ingest.upsertTransaction(u,initial);
        String id=transactionRepository.findByPlaidTransactionIdAndUser_Id(plaidId,u.getId()).orElseThrow().getId();
        ExecutorService pool=Executors.newFixedThreadPool(3); CountDownLatch start=new CountDownLatch(1);
        try {
            List<Future<?>> work=new ArrayList<>();
            work.add(pool.submit(() -> { start.await(); for(int i=0;i<8;i++) ingest.upsertTransaction(u,new PlaidTransaction(plaidId,"Starbucks",date,"Food",20,false,"USD",null,"account","item","FOOD_AND_DRINK_FAST_FOOD",false,null,LocalDate.of(2026,10,15))); return null; }));
            work.add(pool.submit(() -> { start.await(); edits.updateTransaction(auth,id,new UpdateTransactionRequest("Personal name",null,"Personal category",null,null,null,null,null,null,null)); return null; }));
            work.add(pool.submit(() -> { start.await(); try { rules.apply(auth,rule.id(),rules.preview(auth,rule.id()).token()); } catch(org.springframework.web.server.ResponseStatusException conflict) { assertEquals(409,conflict.getStatusCode().value()); } return null; }));
            start.countDown();
            for(Future<?> task:work) task.get(30,TimeUnit.SECONDS);
            var result=new TransactionTemplate(manager).execute(status -> {
                Transaction t=transactionRepository.findById(id).orElseThrow();
                assertEquals("Personal name",t.getName()); assertEquals("Personal Category",t.getCategory()); assertEquals(20,t.getAmount());
                assertEquals(1,transactionRepository.findByUser_IdOrderByDateDesc(u.getId()).size());
                return budgetRepository.findByUser_IdOrderByDateDesc(u.getId()).stream().mapToDouble(Budget::getSpent).sum();
            });
            assertEquals(20,result);
        } finally {
            pool.shutdownNow();
            new TransactionTemplate(manager).executeWithoutResult(status -> { applications.deleteByUser_Id(u.getId()); handoffs.deleteByUser_Id(u.getId()); ruleRepository.deleteByUser_Id(u.getId()); transactionRepository.deleteByUser_Id(u.getId()); budgetRepository.deleteByUser_Id(u.getId()); userRepository.deleteById(u.getId()); });
        }
    }
}
