package com.fintechapp.fintech_api.service;

import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class TransferCacheInvalidationTest {
    @Test void financialEvictionWaitsForSuccessfulCommit() {
        FinancialCacheInvalidator invalidator = spy(new FinancialCacheInvalidator(null, null));
        doNothing().when(invalidator).evictFinancialSummaryRegion("user");
        doNothing().when(invalidator).evictRecurringPayments("user");
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialDataAfterCommit("user");
            verify(invalidator, never()).evictFinancialSummaryRegion("user");
            verify(invalidator, never()).evictRecurringPayments("user");
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            verify(invalidator).evictFinancialSummaryRegion("user");
            verify(invalidator).evictRecurringPayments("user");
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
    @Test void rollbackDoesNotPublishFinancialEviction() {
        FinancialCacheInvalidator invalidator = spy(new FinancialCacheInvalidator(null, null));
        TransactionSynchronizationManager.initSynchronization();
        try {
            invalidator.evictFinancialDataAfterCommit("user");
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(1));
            verify(invalidator, never()).evictFinancialSummaryRegion("user");
            verify(invalidator, never()).evictRecurringPayments("user");
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
}
