package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.rules.RuleRequest;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;
import com.fintechapp.fintech_api.service.*;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

class CategorizationRulesIntegrationTest extends BaseIntegrationTest {
    static final Instant DATE = Instant.parse("2026-10-15T12:00:00Z");
    @Autowired PlaidTransactionIngestService ingest;
    @Autowired CategorizationRuleService rules;
    @Autowired TransactionService edits;
    @Autowired InternalTransferReconciliationService reconciliation;
    @Autowired PendingClassificationHandoffRepository handoffs;
    @Autowired EntityManager em;
    User user() { User u=createUser("rules-"+UUID.randomUUID()+"@example.com","Password123!","Rules"); em.flush(); return u; }
    AuthenticatedUser auth(User u) { return new AuthenticatedUser(u.getId(),u.getEmail(),0); }
    RuleRequest request(String category,int priority,Long revision,boolean enabled) {
        return new RuleRequest("Coffee rule","MERCHANT","NORMALIZED_EXACT","STARBUCKS",null,null,null,category,"Food & Drinks",null,priority,enabled,revision);
    }
    CategorizationRuleService.RuleView rule(User u,String category,int priority) { return rules.save(auth(u),null,request(category,priority,null,true)); }
    PlaidTransaction source(String id,double amount,Instant date,boolean transfer,Boolean pending,String pointer,String account) {
        return new PlaidTransaction(id,"Starbucks",date,"Food",amount,transfer,"USD",null,account,"item","FOOD_AND_DRINK_FAST_FOOD",pending,pointer,LocalDate.of(2026,10,15),amount<0?"refund":"purchase");
    }
    Transaction ingest(User u,String id,double amount) { return ingest(u,source(id,amount,DATE,false,false,null,"account")); }
    Transaction ingest(User u,PlaidTransaction source) {
        ingest.upsertTransaction(u,source); em.flush(); em.clear(); return transactionRepository.findByPlaidTransactionIdAndUser_Id(source.transactionId(),u.getId()).orElseThrow();
    }
    Transaction fresh(String id) { em.flush(); em.clear(); return transactionRepository.findById(id).orElseThrow(); }
    double spent(User u) { em.flush(); em.clear(); return budgetRepository.findByUser_IdOrderByDateDesc(u.getId()).stream().mapToDouble(Budget::getSpent).sum(); }
    @Test void explicitEditsSurviveProviderChangesAndReconcileAmountAndMonth() {
        User u=user(); Transaction t=ingest(u,"one",10); Budget b=createBudget(u,"My Food",100,DATE); em.flush();
        edits.updateTransaction(auth(u),t.getId(),new UpdateTransactionRequest("My coffee",null,"Coffee",null,null,null,b.getId(),null,null,null));
        t=ingest(u,"one",25); assertEquals("My coffee",t.getName()); assertEquals("Coffee",t.getCategory()); assertEquals(b.getId(),t.getBudget().getId()); assertEquals(25,spent(u));
        t=ingest(u,source("one",30,Instant.parse("2026-11-15T12:00:00Z"),false,false,null,"account"));
        assertEquals("My Food",t.getBudget().getCategory()); assertEquals("2026-11",YearMonth.from(t.getBudget().getDate().atZone(ZoneOffset.UTC)).toString()); assertEquals(30,spent(u));
        assertEquals(0,budgetRepository.findById(b.getId()).orElseThrow().getSpent());
    }
    @Test void priorityAndSnapshotsAreStableAndCreationDoesNotRewriteHistory() {
        User u=user(); Transaction old=ingest(u,"old",10); var low=rule(u,"Low",20); var high=rule(u,"Coffee",1);
        assertEquals("Food",fresh(old.getId()).getCategory()); Transaction future=ingest(u,"new",20); assertEquals("Coffee",future.getCategory()); assertEquals(high.id(),future.getAppliedRuleId());
        rules.save(auth(u),high.id(),request("Edited",1,high.revision(),false)); assertEquals("Coffee",ingest(u,"new",22).getCategory());
        assertEquals("Low",ingest(u,"later",5).getCategory()); rules.delete(auth(u),low.id(),low.revision()); assertEquals("Food",ingest(u,"last",3).getCategory());
    }
    @Test void previewConflictsProtectedOverridesRepeatAndUndoUseIdenticalDecisions() {
        User u=user(); Transaction t=ingest(u,"one",10); var low=rule(u,"Low",20); var high=rule(u,"Coffee",1);
        var skipped=rules.preview(auth(u),low.id()); assertEquals("Food",skipped.matches().get(0).proposedCategory()); assertEquals(2,skipped.matches().get(0).matchingRules().size());
        assertEquals(0,rules.apply(auth(u),low.id(),skipped.token()).changed());
        var preview=rules.preview(auth(u),high.id()); var batch=rules.apply(auth(u),high.id(),preview.token()); assertEquals(1,batch.changed()); assertEquals("Coffee",fresh(t.getId()).getCategory()); assertEquals(10,spent(u));
        String staleToken=preview.token(); assertThrows(ResponseStatusException.class,()->rules.apply(auth(u),high.id(),staleToken));
        assertEquals(0,rules.apply(auth(u),high.id(),rules.preview(auth(u),high.id()).token()).changed()); assertEquals(10,spent(u));
        assertEquals(1,rules.undo(auth(u),batch.applicationId()).changed()); assertEquals("Food",fresh(t.getId()).getCategory()); assertEquals(10,spent(u)); assertEquals(0,rules.undo(auth(u),batch.applicationId()).changed());
        edits.updateTransaction(auth(u),t.getId(),new UpdateTransactionRequest("Personal",null,"User Choice",null,null,null,null,null,null,null));
        preview=rules.preview(auth(u),high.id()); assertTrue(preview.matches().get(0).protectedOverride()); assertEquals("User Choice",preview.matches().get(0).proposedCategory());
        rules.apply(auth(u),high.id(),preview.token()); assertEquals("Personal",fresh(t.getId()).getName()); assertEquals("User Choice",fresh(t.getId()).getCategory());
    }
    @Test void undoRejectsLaterEdits() {
        User u=user(); Transaction t=ingest(u,"one",10); var rule=rule(u,"Coffee",1); var batch=rules.apply(auth(u),rule.id(),rules.preview(auth(u),rule.id()).token());
        edits.updateTransaction(auth(u),t.getId(),new UpdateTransactionRequest("New decision",null,null,null,null,null,null,null,null,null));
        assertThrows(ResponseStatusException.class,()->rules.undo(auth(u),batch.applicationId())); assertEquals("New decision",fresh(t.getId()).getName()); assertEquals(10,spent(u));
    }
    @Test void providerResetIsProtectedFromHistoryAndFutureUpdates() {
        User u=user(); Transaction t=ingest(u,"one",10); var rule=rule(u,"Coffee",1); rules.reset(auth(u),t.getId(),false);
        var preview=rules.preview(auth(u),rule.id()); assertEquals("Food",preview.matches().get(0).proposedCategory()); assertEquals(0,rules.apply(auth(u),rule.id(),preview.token()).changed());
        assertEquals("Food",ingest(u,"one",20).getCategory()); assertTrue(fresh(t.getId()).isRulesDisabled());
    }
    @Test void refundsTransfersAndRepeatedIngestionNeverDoubleCount() {
        User u=user(); rule(u,"Coffee",1); ingest(u,"purchase",100); Transaction refund=ingest(u,"refund",-40);
        assertEquals(-40,refund.getAmount()); assertEquals(60,spent(u)); ingest(u,"refund",-40); assertEquals(60,spent(u));
        Transaction transfer=ingest(u,source("transfer",500,DATE,true,false,null,"account")); assertNull(transfer.getBudget()); assertEquals(60,spent(u));
        ingest(u,source("purchase",100,DATE,true,false,null,"account")); assertEquals(-40,spent(u));
    }
    @Test void removedPendingChoicesSurviveSeparatePagesAndAreConsumedOnlyInSameScope() {
        User u=user(); Transaction pending=ingest(u,source("pending",10,DATE,false,true,null,"account"));
        edits.updateTransaction(auth(u),pending.getId(),new UpdateTransactionRequest("My coffee",null,"Coffee",null,null,null,null,null,null,null));
        ingest.removeByPlaidIds(List.of("pending"),u.getId()); em.flush(); em.clear(); assertEquals(0,spent(u));
        assertTrue(handoffs.findByUser_IdAndItemIdAndAccountIdAndPendingId(u.getId(),"item","account","pending").isPresent());
        Transaction wrong=ingest(u,source("wrong",10,DATE,false,false,"pending","other-account")); assertNull(wrong.getCategoryOverride());
        Transaction posted=ingest(u,source("posted",12,DATE,false,false,"pending","account")); assertEquals("My coffee",posted.getName()); assertEquals("Coffee",posted.getCategory());
        assertTrue(handoffs.findByUser_IdAndItemIdAndAccountIdAndPendingId(u.getId(),"item","account","pending").isEmpty()); assertEquals(22,spent(u));
        ingest(u,source("posted",12,DATE,false,false,"pending","account")); assertEquals(22,spent(u));
    }
    @Test void pendingAndPostedInSameRunCarryChoicesAndRetireOneRow() {
        User u=user(); Transaction pending=ingest(u,source("pending",10,DATE,false,true,null,"account"));
        edits.updateTransaction(auth(u),pending.getId(),new UpdateTransactionRequest("Mine",null,"Coffee",null,null,null,null,null,null,null));
        Transaction posted=ingest(u,source("posted",12,DATE,false,false,"pending","account")); reconciliation.reconcile(u.getId()); em.flush(); em.clear();
        assertEquals("Mine",fresh(posted.getId()).getName()); assertTrue(transactionRepository.findByPlaidTransactionIdAndUser_Id("pending",u.getId()).isEmpty()); assertEquals(12,spent(u));
    }
    @Test void rulesAndHistoryAreIsolatedByOwnerAndRevision() {
        User u=user(),other=user(); var rule=rule(u,"Coffee",1); ingest(other,"other",10); assertTrue(rules.list(auth(other)).isEmpty());
        assertThrows(ResponseStatusException.class,()->rules.preview(auth(other),rule.id()));
        assertThrows(ResponseStatusException.class,()->rules.save(auth(u),rule.id(),request("Bad",1,99L,true)));
        assertEquals("Food",transactionRepository.findByPlaidTransactionIdAndUser_Id("other",other.getId()).orElseThrow().getCategory());
    }
    @Test void ambiguousLegacyClassificationsArePreservedWithoutInventingUserOverrides() {
        User u=user(); Transaction t=ingest(u,"old",10); t.setLegacyClassification(true); t.setLegacyName("Old personal label"); t.setLegacyCategory("Old category"); t.setLegacyBudgetCategory("Food"); transactionRepository.saveAndFlush(t);
        t=ingest(u,"old",15); assertEquals("Old personal label",t.getName()); assertEquals("Old category",t.getCategory()); assertNull(t.getNameOverride()); assertEquals("Starbucks",t.getProviderName()); assertEquals(15,spent(u));
    }

    @Test void matchingModesAndOptionalConditionsUseProviderFacts() {
        User u=user(); Transaction t=ingest(u,"one",10); t.setDescription("Monthly COFFEE: morning"); transactionRepository.saveAndFlush(t);
        var request=new RuleRequest("Description","DESCRIPTION","CONTAINS","coffee", "EXPENSE","account","Food","Drinks",null,"Morning coffee",2,true,null);
        var rule=rules.save(auth(u),null,request); assertEquals(1,rules.preview(auth(u),rule.id()).matches().size());
        rules.apply(auth(u),rule.id(),rules.preview(auth(u),rule.id()).token()); assertEquals("Morning coffee",fresh(t.getId()).getName());
        var exact=rules.save(auth(u),null,new RuleRequest("Exact","MERCHANT","EXACT","STARBUCKS",null,null,null,"No",null,null,0,true,null));
        assertTrue(rules.preview(auth(u),exact.id()).matches().isEmpty());
        assertThrows(ResponseStatusException.class,()->rules.save(auth(u),null,new RuleRequest("Scope","MERCHANT","EXACT","Starbucks",null,"unowned",null,"No",null,null,1,true,null)));
    }
    @Test void migrationIsIdempotentAndPreservesAmbiguousHistory() throws Exception {
        String schema="migration_"+UUID.randomUUID().toString().replace("-","");
        String sql=new String(new org.springframework.core.io.ClassPathResource("db/migration/V24__transaction_categorization_rules.sql").getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
        for(String table:List.of("pending_classification_handoffs","categorization_rules","rule_applications","transactions","budgets","users")) sql=sql.replaceAll("\\b"+table+"\\b",schema+"."+table);
        String script=sql;
        em.unwrap(org.hibernate.Session.class).doWork(connection -> {
            try(var statement=connection.createStatement()) {
                statement.execute("CREATE SCHEMA "+schema);
                statement.execute("CREATE TABLE "+schema+".users(id varchar(36) primary key)");
                statement.execute("CREATE TABLE "+schema+".budgets(id varchar(36) primary key, category varchar(255), spent double precision)");
                statement.execute("CREATE TABLE "+schema+".transactions(id varchar(36) primary key, name varchar(255), category varchar(255), budget_id varchar(36))");
                statement.execute("INSERT INTO "+schema+".users VALUES ('u')");
                statement.execute("INSERT INTO "+schema+".budgets VALUES ('b','My budget',37)");
                statement.execute("INSERT INTO "+schema+".transactions VALUES ('t','My name','My category','b')");
                statement.execute(script); statement.execute(script);
                try(var result=statement.executeQuery("SELECT * FROM "+schema+".transactions WHERE id='t'")) {
                    assertTrue(result.next()); assertEquals("My name",result.getString("name")); assertEquals("My category",result.getString("category")); assertEquals("b",result.getString("budget_id"));
                    assertTrue(result.getBoolean("legacy_classification")); assertEquals("My budget",result.getString("legacy_budget_category")); assertNull(result.getString("name_override")); assertNull(result.getString("provider_name"));
                }
                statement.execute("INSERT INTO "+schema+".transactions(id,name,category) VALUES ('new','New','Food')");
                statement.execute(script);
                try(var result=statement.executeQuery("SELECT legacy_classification FROM "+schema+".transactions WHERE id='new'")) { assertTrue(result.next()); assertFalse(result.getBoolean(1)); }
                try(var result=statement.executeQuery("SELECT spent FROM "+schema+".budgets WHERE id='b'")) { assertTrue(result.next()); assertEquals(37,result.getDouble(1)); }
            }
        });
    }
    @Test void controllerRejectsUnownedIdsAndRequiresAuthentication() throws Exception {
        User u=user(),other=user(); var rule=rule(u,"Coffee",1);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/categorization-rules/"+rule.id()+"/preview").header(authHeaderName(),authHeader(other)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/categorization-rules"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
    }

    @Test void undoRejectsAnOriginalBudgetThatWasRenamed() {
        User u=user(); Transaction t=ingest(u,"one",10); String original=t.getBudget().getId(); var rule=rule(u,"Coffee",1);
        var batch=rules.apply(auth(u),rule.id(),rules.preview(auth(u),rule.id()).token());
        Budget budget=budgetRepository.findById(original).orElseThrow(); budget.setCategory("Renamed original"); budgetRepository.saveAndFlush(budget);
        assertThrows(ResponseStatusException.class,()->rules.undo(auth(u),batch.applicationId())); assertEquals("Coffee",fresh(t.getId()).getCategory()); assertEquals(10,spent(u));
    }
    @Test void manualCreationPersistsUserChoicesAndCannotBeReplacedByHistoryRules() {
        User u=user(); Budget budget=createBudget(u,"Food",100,DATE); em.flush();
        var item=edits.createTransaction(auth(u),new com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest("Starbucks",9,2026,DATE.toString(),"Coffee","EXPENSE",10.0,null,budget.getId(),null,null,null)).data().transaction();
        var rule=rule(u,"Other",1); rules.apply(auth(u),rule.id(),rules.preview(auth(u),rule.id()).token());
        Transaction t=fresh(item.id()); assertEquals("Coffee",t.getCategory()); assertEquals("Starbucks",t.getName()); assertEquals(budget.getId(),t.getBudget().getId()); assertEquals("USER",item.classification().categorySource()); assertEquals(10,spent(u));
    }

    @Test void controllerSupportsValidatedRuleCrudAndClassificationReset() throws Exception {
        User u=user(); Transaction t=ingest(u,"one",10);
        var created=mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/categorization-rules").header(authHeaderName(),authHeader(u)).contentType(json()).content(asJson(request("Coffee",1,null,true))))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andReturn();
        String id=objectMapper.readTree(created.getResponse().getContentAsString()).path("data").path("id").asText();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/categorization-rules/"+id).header(authHeaderName(),authHeader(u)).contentType(json()).content(asJson(request("Drinks",2,1L,true))))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/transactions/"+t.getId()+"/classification/reset").header(authHeaderName(),authHeader(u)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/categorization-rules/"+id).param("revision","2").header(authHeaderName(),authHeader(u)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertTrue(rules.list(auth(u)).isEmpty());
    }

    @Test void editingMatchingConditionsIsFutureOnlyEvenWhenAnOldUnmatchedRowIsModified() {
        User u=user(); var initial=rules.save(auth(u),null,new RuleRequest("Future rule","MERCHANT","EXACT","Other merchant",null,null,null,"Coffee",null,null,1,true,null));
        Transaction old=ingest(u,"old",10); assertEquals("Food",old.getCategory());
        rules.save(auth(u),initial.id(),request("Coffee",1,initial.revision(),true));
        assertEquals("Food",ingest(u,"old",15).getCategory()); assertEquals("Coffee",ingest(u,"future",20).getCategory());
        rules.reset(auth(u),old.getId(),true); assertEquals("Coffee",fresh(old.getId()).getCategory());
    }
}
