package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;

/**
 * Detector tests for {@link RecurringPaymentService} — the financial-correctness
 * heart of Upcoming Bills. Every fixture is deterministic: a fixed "today" and
 * explicit UTC dates, so cadence math is verifiable to the day.
 *
 * <p>False positives are treated as worse than false negatives throughout:
 * several tests exist purely to prove that plausible-looking noise (frequent
 * marketplaces, duplicates, refunds, transfers, dormant series) never becomes
 * an "upcoming bill".</p>
 */
class RecurringPaymentServiceTest {

    /** Fixed now: 2026-08-25T12:00Z. */
    private final Instant now = utc(2026, 8, 25);

    private final RecurringPaymentService service = new RecurringPaymentService(null);

    // ── Fixture helpers ────────────────────────────────────────────────────

    private static Instant utc(int year, int month, int day) {
        return LocalDate.of(year, month, day).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static Transaction tx(String name, double amount, Instant date) {
        Transaction t = new Transaction();
        t.setName(name);
        t.setAmount(amount);
        t.setDate(date);
        t.setCategory("RENT");
        t.setType(TransactionType.EXPENSE);
        t.setBaseCurrency("USD");
        return t;
    }

    /** Monthly charge on the given day-of-month across consecutive months. */
    private List<Transaction> monthly(String name, double amount, int dayOfMonth,
            int startYear, int startMonth, int count) {
        List<Transaction> list = new ArrayList<>();
        int year = startYear;
        int month = startMonth;
        for (int i = 0; i < count; i++) {
            list.add(tx(name, amount, utc(year, month, dayOfMonth)));
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }
        return list;
    }

    // ── Happy paths ────────────────────────────────────────────────────────

    @Test
    void detectsMonthlyRecurringPaymentWithHighConfidence() {
        List<Transaction> rent = monthly("Rent", 1450.00, 1, 2026, 3, 6);

        List<Item> items = service.detect(rent, now);

        assertEquals(1, items.size());
        Item rent1 = items.get(0);
        assertEquals("Rent", rent1.name());
        assertEquals("MONTHLY", rent1.cadence());
        assertEquals("HIGH", rent1.confidence());
        assertEquals(6, rent1.occurrences());
        assertEquals(1450.00, rent1.expectedAmount());
        assertEquals(1, rent1.usualDayOfMonth());
        assertNull(rent1.amountChange());
        // Last occurrence Aug 1 → next projection ~Sep 1 (31-day median interval).
        assertTrue(rent1.nextExpectedDate().startsWith("2026-09"));
    }

    @Test
    void detectsWeeklyRecurringPayment() {
        List<Transaction> list = new ArrayList<>();
        // Gym every 7 days, 6 occurrences ending 4 days before "now".
        LocalDate first = LocalDate.of(2026, 7, 14);
        for (int i = 0; i < 6; i++) {
            list.add(tx("FitGym", 25.00, first.plusDays(7L * i)
                    .atStartOfDay().toInstant(ZoneOffset.UTC)));
        }

        List<Item> items = service.detect(list, now);

        assertEquals(1, items.size());
        assertEquals("WEEKLY", items.get(0).cadence());
        assertEquals(7, items.get(0).intervalDays());
        assertNull(items.get(0).usualDayOfMonth()); // only monthly gets a day hint
    }

    @Test
    void detectsBiweeklyRecurringPayment() {
        List<Transaction> list = new ArrayList<>();
        LocalDate first = LocalDate.of(2026, 6, 12);
        for (int i = 0; i < 5; i++) {
            list.add(tx("CleanCo", 80.00, first.plusDays(14L * i)
                    .atStartOfDay().toInstant(ZoneOffset.UTC)));
        }

        List<Item> items = service.detect(list, now);

        assertEquals(1, items.size());
        assertEquals("BIWEEKLY", items.get(0).cadence());
    }

        @Test
    void toleratesReasonableDateJitterAroundTheSameDayOfMonth() {
        List<Transaction> internet = new ArrayList<>();
        // Internet bill drifting a few days around month end — three cycles
        // with realistic ±3-day jitter (minimum evidence → MEDIUM confidence).
        internet.add(tx("Internet", 82.00, utc(2026, 6, 30)));
        internet.add(tx("Internet", 82.00, utc(2026, 7, 29)));
        internet.add(tx("Internet", 82.00, utc(2026, 8, 24)));

        List<Item> items = service.detect(internet, now);

        assertEquals(1, items.size());
        assertEquals("MONTHLY", items.get(0).cadence());
        assertEquals("MEDIUM", items.get(0).confidence()); // jittery but real
    }

    @Test
    void rejectsImplausibleCycleCollapse() {
        // Jul 29 → Aug 2 is a four-day "monthly" gap: a billing-cycle collapse
        // or a double charge — too ambiguous to present as a bill.
        List<Transaction> weird = new ArrayList<>();
        weird.add(tx("Internet", 82.00, utc(2026, 5, 28)));
        weird.add(tx("Internet", 82.00, utc(2026, 6, 30)));
        weird.add(tx("Internet", 82.00, utc(2026, 7, 29)));
        weird.add(tx("Internet", 82.00, utc(2026, 8, 2)));

        assertTrue(service.detect(weird, now).isEmpty());
    }

    // ── Amount handling ────────────────────────────────────────────────────

    @Test
    void surfacesMeaningfulAmountChangeInsteadOfSilentlyAbsorbingIt() {
        List<Transaction> spotify = monthly("Spotify", 11.99, 27, 2026, 4, 4);
        // Latest occurrence jumped to 17.99 — a real price change.
        spotify.add(tx("Spotify", 17.99, utc(2026, 8, 27)));

        List<Item> items = service.detect(spotify, now);

        assertEquals(1, items.size());
        assertEquals(17.99, items.get(0).expectedAmount()); // recency wins
        assertNotNull(items.get(0).amountChange());
        assertEquals(11.99, items.get(0).amountChange().previousAmount());
        assertEquals(17.99, items.get(0).amountChange().currentAmount());
    }

    @Test
    void ignoresTinyRoundingDifferences() {
        List<Transaction> icloud = new ArrayList<>();
        icloud.add(tx("iCloud", 2.99, utc(2026, 5, 20)));
        icloud.add(tx("iCloud", 2.99, utc(2026, 6, 20)));
        icloud.add(tx("iCloud", 3.00, utc(2026, 7, 20))); // one-cent drift
        icloud.add(tx("iCloud", 2.99, utc(2026, 8, 20)));

        List<Item> items = service.detect(icloud, now);

        assertEquals(1, items.size());
        assertNull(items.get(0).amountChange()); // rounding noise, not a price change
    }

    // ── Merchant normalization ─────────────────────────────────────────────

    @Test
    void groupsMerchantNameVariantsTogether() {
        List<Transaction> netflix = new ArrayList<>();
        netflix.add(tx("NETFLIX.COM", 15.49, utc(2026, 5, 3)));
        netflix.add(tx("Netflix", 15.49, utc(2026, 6, 3)));
        netflix.add(tx("SQ * NETFLIX 4029357733", 15.49, utc(2026, 7, 3)));
        netflix.add(tx("netflix.com 866-579-7172", 15.49, utc(2026, 8, 3)));

        List<Item> items = service.detect(netflix, now);

        assertEquals(1, items.size());
        assertEquals("NETFLIX.COM", items.get(0).name()); // earliest-seen raw variant wins ties
        assertTrue(items.get(0).seriesKey().contains("NETFLIX"));
        assertEquals(4, items.get(0).occurrences());
    }

    // ── False-positive defenses ────────────────────────────────────────────

    @Test
    void rejectsFrequentMerchantWithoutTemporalRegularity() {
        // Amazon: many purchases at irregular gaps and wildly varying amounts.
        List<Transaction> amazon = new ArrayList<>();
        amazon.add(tx("Amazon", 23.17, utc(2026, 3, 4)));
        amazon.add(tx("Amazon", 156.90, utc(2026, 3, 19)));
        amazon.add(tx("Amazon", 41.05, utc(2026, 4, 22)));
        amazon.add(tx("Amazon", 9.99, utc(2026, 5, 7)));
        amazon.add(tx("Amazon", 210.43, utc(2026, 6, 30)));
        amazon.add(tx("Amazon", 64.12, utc(2026, 7, 8)));

        assertTrue(service.detect(amazon, now).isEmpty());
    }

    @Test
    void rejectsRegularlyTimedMerchantWithErraticAmounts() {
        // Same-day rhythm but basket-like amounts (shared-card groceries).
        List<Transaction> list = new ArrayList<>();
        list.add(tx("Market", 32.10, utc(2026, 4, 15)));
        list.add(tx("Market", 187.55, utc(2026, 5, 15)));
        list.add(tx("Market", 54.02, utc(2026, 6, 16)));
        list.add(tx("Market", 240.88, utc(2026, 7, 15)));

        assertTrue(service.detect(list, now).isEmpty());
    }

    @Test
    void transferFlaggedRowsNeverCountTowardASeries() {
        // Six "rent" rows but every other one is a proof-based internal
        // transfer (e.g. a manual transfer labelled Rent): only the three
        // genuine expenses may be considered — below/equal minimum evidence,
        // and crucially no bill is invented from transfer rows.
        List<Transaction> rows = monthly("Rent", 1450.00, 1, 2026, 3, 6);
        for (int i = 1; i < rows.size(); i += 2) {
            rows.get(i).setTransfer(true);
        }
        // Non-transfer survivors: Mar/May/Jul = 3 occurrences with ~60d gaps →
        // not monthly; must NOT surface as a bill.
        assertTrue(service.detect(rows, now).isEmpty());
    }

    @Test
    void incomeTransactionsCanNeverBecomeBills() {
        Transaction p1 = tx("ACME Payroll", 3200.00, utc(2026, 6, 1));
        Transaction p2 = tx("ACME Payroll", 3200.00, utc(2026, 7, 1));
        Transaction p3 = tx("ACME Payroll", 3200.00, utc(2026, 8, 3));
        p1.setType(TransactionType.INCOME);
        p2.setType(TransactionType.INCOME);
        p3.setType(TransactionType.INCOME);

        assertTrue(service.detect(List.of(p1, p2, p3), now).isEmpty());
    }

    @Test
    void refundShapedRowsAreExcluded() {
        Transaction refundAdj = tx("Spotify Refund", -11.99, utc(2026, 7, 2));
        Transaction refundIncome = tx("Refund", 42.00, utc(2026, 6, 2));
        refundIncome.setType(TransactionType.INCOME);

        assertTrue(service.detect(new ArrayList<>(List.of(refundAdj, refundIncome)), now).isEmpty());
    }

    @Test
    void duplicateSameDayChargesCollapseIntoOneOccurrence() {
        // Auth+capture double-post: two identical charges same day each month.
        List<Transaction> netflix = monthly("Netflix", 15.49, 3, 2026, 4, 5);
        List<Transaction> doubled = new ArrayList<>();
        for (Transaction t : netflix) {
            Transaction copy = tx(t.getName(), t.getAmount(),
                    t.getDate().plusSeconds(3600)); // same day, an hour later
            copy.setId("dup-" + doubled.size());
            doubled.add(t);
            doubled.add(copy);
        }

        List<Item> items = service.detect(doubled, now);

        assertEquals(1, items.size());
        assertEquals(5, items.get(0).occurrences()); // duplicates collapsed
        assertEquals(15.49, items.get(0).expectedAmount());
    }

    @Test
    void survivesASingleMissedCycle() {
        // Monthly rent, July skipped entirely (one ~60d gap).
        List<Transaction> rent = new ArrayList<>();
        rent.add(tx("Rent", 1450.00, utc(2026, 4, 1)));
        rent.add(tx("Rent", 1450.00, utc(2026, 5, 1)));
        rent.add(tx("Rent", 1450.00, utc(2026, 6, 1)));
        rent.add(tx("Rent", 1450.00, utc(2026, 8, 3)));

        List<Item> items = service.detect(rent, now);

        assertEquals(1, items.size());
        assertEquals("MONTHLY", items.get(0).cadence());
    }

    @Test
    void dropsDormantSeries() {
        // Perfect series that stopped ~4 months ago (cancelled subscription).
        List<Transaction> old = monthly("OldGym", 30.00, 10, 2025, 9, 4);

        assertTrue(service.detect(old, now).isEmpty());
    }

    @Test
    void quarterlySubscriptionsSurfaceWithMediumEvidence() {
        List<Transaction> insurance = new ArrayList<>();
        insurance.add(tx("AutoInsurance", 480.00, utc(2025, 11, 15)));
        insurance.add(tx("AutoInsurance", 480.00, utc(2026, 2, 14)));
        insurance.add(tx("AutoInsurance", 480.00, utc(2026, 5, 16)));

        List<Item> items = service.detect(insurance, now);

        assertEquals(1, items.size());
        assertEquals("QUARTERLY", items.get(0).cadence());
        assertEquals("MEDIUM", items.get(0).confidence());
    }

    @Test
    void yearlySubscriptionsWithTooFewOccurrencesNeverSurface() {
        List<Transaction> annual = new ArrayList<>();
        annual.add(tx("AnnualFee", 99.00, utc(2025, 9, 1)));
        annual.add(tx("AnnualFee", 99.00, utc(2026, 8, 28)));

        assertTrue(service.detect(annual, now).isEmpty());
    }

    @Test
    void detectsMultipleMerchantsSortedByNextDate() {
        List<Transaction> history = new ArrayList<>();
        history.addAll(monthly("Rent", 1450.00, 1, 2026, 3, 6));     // next ~Sep 1
        history.addAll(monthly("Spotify", 11.99, 27, 2026, 3, 6));   // next ~Sep 27... (Aug 27 + 30)
        history.addAll(monthly("Internet", 82.00, 20, 2026, 3, 6));  // next ~Sep 19

        List<Item> items = service.detect(history, now);

        assertEquals(3, items.size());
        assertTrue(items.get(0).nextExpectedDate()
                .compareTo(items.get(items.size() - 1).nextExpectedDate()) <= 0);
    }

    @Test
    void emptyHistoryYieldsNoPredictions() {
        assertTrue(service.detect(List.of(), now).isEmpty());
    }

    @Test
    void largeHistoriesStayBoundedAndFast() {
        // ~2,400 rows: one real bill series plus a wall of one-off noise —
        // mirrors a heavy Plaid user over a year and guards against accidental
        // O(n²) blowups in grouping/collapse.
        List<Transaction> history = new ArrayList<>();
        history.addAll(monthly("Rent", 1450.00, 1, 2025, 9, 12));
        for (int i = 0; i < 2388; i++) {
            LocalDate day = LocalDate.of(2025, 9, 1).plusDays(i / 7);
            history.add(tx("Store " + (i % 40), 5 + (i % 90),
                    day.atStartOfDay().toInstant(ZoneOffset.UTC)));
        }

        long start = System.nanoTime();
        List<Item> items = service.detect(history, now);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertEquals(1, items.size()); // only the genuine series surfaces
        assertEquals("Rent", items.get(0).name());
        assertTrue(elapsedMs < 2000, "detection took too long: " + elapsedMs + "ms");
    }
}

