package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

class PlaidRefundDetectorTest {
    @ParameterizedTest
    @CsvSource(value = {
        "-40,Unknown,NONE,Merchant,refund,true",
        "-40,Food,FOOD_AND_DRINK_FAST_FOOD,Merchant,NONE,true",
        "-40,Income,INCOME_WAGES,Refund Payroll,NONE,false",
        "-40,Transfer,TRANSFER_IN_DEPOSIT,Refund Deposit,NONE,false",
        "-40,Transfer,TRANSFER_IN_ACCOUNT_TRANSFER,Refund,NONE,false",
        "-40,Unknown,NONE,Merchant,NONE,false",
        "-40,Transfer,TRANSFER_IN_REFUND,Merchant,NONE,true",
        "40,Food,FOOD_AND_DRINK_FAST_FOOD,Refund,refund,false",
        "-40,Refund,NONE,Merchant,NONE,true",
        "-40,Unknown,NONE,REFUND Merchant,NONE,true",
        "-40,Food,INCOME_WAGES,Merchant,NONE,false",
        "-40,Income,TRANSFER_IN_REFUND,Merchant,NONE,true"
    }, nullValues = "NONE")
    void explicitRefundEvidenceDoesNotTurnOrdinaryDepositsOrPayrollIntoCredits(
            double amount, String category, String detailed, String name, String code, boolean expected) {
        var tx = new PlaidTransaction("id", name, Instant.parse("2026-10-15T00:00:00Z"), category, amount,
                false, "USD", null, "account", "item", detailed, false, null, LocalDate.of(2026, 10, 15), code);
        assertEquals(expected, PlaidRefundDetector.isRefund(tx));
    }
}
