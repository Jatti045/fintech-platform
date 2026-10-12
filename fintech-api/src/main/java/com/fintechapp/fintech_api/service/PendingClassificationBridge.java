package com.fintechapp.fintech_api.service;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import com.fintechapp.fintech_api.model.*;
import com.fintechapp.fintech_api.repository.*;

@Service
public class PendingClassificationBridge {
    private final PendingClassificationHandoffRepository handoffs;
    private final TransactionRepository transactions;
    private final ObjectMapper mapper;
    public PendingClassificationBridge(PendingClassificationHandoffRepository handoffs,TransactionRepository transactions,ObjectMapper mapper) { this.handoffs=handoffs; this.transactions=transactions; this.mapper=mapper; }
    public record Choices(String name, String category, String budgetId, String budgetCategory, boolean rulesDisabled,
            boolean legacy, String legacyName, String legacyCategory, String legacyBudget, String ruleId, Long revision,
            String ruleTitle, String ruleName, String ruleCategory, String ruleBudget) {}
    public void retain(Transaction t) {
        if(!Boolean.TRUE.equals(t.getPlaidPending()) || t.getPlaidItemId()==null || t.getPlaidAccountId()==null || t.getPlaidTransactionId()==null) return;
        if(transactions.existsByUser_IdAndPlaidItemIdAndPlaidAccountIdAndPlaidPendingTransactionIdAndPlaidPendingFalse(
                t.getUser().getId(),t.getPlaidItemId(),t.getPlaidAccountId(),t.getPlaidTransactionId())) return;
        var record=handoffs.findByUser_IdAndItemIdAndAccountIdAndPendingId(t.getUser().getId(),t.getPlaidItemId(),t.getPlaidAccountId(),t.getPlaidTransactionId()).orElseGet(() -> {
            var h=new PendingClassificationHandoff(); h.setId(UUID.randomUUID().toString()); h.setUser(t.getUser()); h.setItemId(t.getPlaidItemId()); h.setAccountId(t.getPlaidAccountId()); h.setPendingId(t.getPlaidTransactionId()); return h;
        });
        record.setChoicesJson(mapper.writeValueAsString(choices(t))); record.setCreatedAt(Instant.now()); handoffs.save(record);
    }
    public void inherit(Transaction posted) {
        if(!Boolean.FALSE.equals(posted.getPlaidPending()) || posted.getPlaidPendingTransactionId()==null || posted.getPlaidItemId()==null || posted.getPlaidAccountId()==null) return;
        var pending=transactions.findByPlaidTransactionIdAndUser_Id(posted.getPlaidPendingTransactionId(),posted.getUser().getId()).orElse(null);
        var retained=handoffs.findByUser_IdAndItemIdAndAccountIdAndPendingId(posted.getUser().getId(),posted.getPlaidItemId(),posted.getPlaidAccountId(),posted.getPlaidPendingTransactionId());
        Choices choices=null;
        if(pending!=null && Boolean.TRUE.equals(pending.getPlaidPending()) && Objects.equals(posted.getPlaidItemId(),pending.getPlaidItemId()) && Objects.equals(posted.getPlaidAccountId(),pending.getPlaidAccountId())) choices=choices(pending);
        else if(retained.isPresent()) choices=mapper.readValue(retained.get().getChoicesJson(),Choices.class);
        if(choices==null) return;
        if(posted.getNameOverride()==null) posted.setNameOverride(choices.name());
        if(posted.getCategoryOverride()==null) posted.setCategoryOverride(choices.category());
        if(posted.getBudgetOverrideCategory()==null) { posted.setBudgetOverrideCategory(choices.budgetCategory()); posted.setBudgetOverrideId(choices.budgetId()); }
        posted.setRulesDisabled(posted.isRulesDisabled() || choices.rulesDisabled());
        if(posted.getAppliedRuleId()==null) { posted.setAppliedRuleId(choices.ruleId()); posted.setAppliedRuleVersion(choices.revision()); posted.setRuleTitle(choices.ruleTitle()); posted.setRuleDisplayName(choices.ruleName()); posted.setRuleCategory(choices.ruleCategory()); posted.setRuleBudgetCategory(choices.ruleBudget()); }
        if(choices.legacy()) { posted.setLegacyClassification(true); posted.setLegacyName(choices.legacyName()); posted.setLegacyCategory(choices.legacyCategory()); posted.setLegacyBudgetCategory(choices.legacyBudget()); }
        retained.ifPresent(handoffs::delete);
    }
    private Choices choices(Transaction t) { return new Choices(t.getNameOverride(),t.getCategoryOverride(),t.getBudgetOverrideId(),t.getBudgetOverrideCategory(),t.isRulesDisabled(),t.isLegacyClassification(),t.getLegacyName()!=null?t.getLegacyName():t.getName(),t.getLegacyCategory()!=null?t.getLegacyCategory():t.getCategory(),t.getLegacyBudgetCategory(),t.getAppliedRuleId(),t.getAppliedRuleVersion(),t.getRuleTitle(),t.getRuleDisplayName(),t.getRuleCategory(),t.getRuleBudgetCategory()); }
}
