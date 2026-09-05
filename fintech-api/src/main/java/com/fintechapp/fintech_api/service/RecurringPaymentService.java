package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.config.CacheConfig;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item.AmountChange;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Data;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item;
import com.fintechapp.fintech_api.dto.recurring.RecurringPaymentsResponse.Item.MatchedTransaction;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Detects likely recurring payments ("upcoming bills") from the user's expense
 * history. Read-only and computed on demand; nothing is persisted.
 *
 * <p><b>Conservatism is the design goal</b> — a missed bill costs one glance
 * at the calendar, but a false positive erodes trust in every number Budgee
 * shows. The detector therefore requires:</p>
 *
 * <ul>
 *   <li>expenses only, internal transfers excluded, positive amounts only
 *   (income can never become a bill; refunds carry non-positive amounts or an
 *   INCOME type and are structurally filtered);</li>
 *   <li>a bounded {@value #HISTORY_DAYS}-day window served by the
 *   {@code idx_transactions_user_date} index — long enough for twelve monthly
 *   cycles yet short enough that yearly subscriptions can never reach the
 *   three-occurrence minimum, so they are excluded by construction;</li>
 *   <li>at least {@value #MIN_OCCURRENCES} collapsed occurrences with
 *   temporally regular intervals (see cadence bands below) — frequent
 *   merchants without temporal rhythm fail here;</li>
 *   <li>amount stability: relative variation of at most
 *   {@value #MAX_AMOUNT_CV_MEDIUM}, with sub-dollar wobble clamped so rounding
 *   never distorts a series;</li>
 *   <li>evidence of life: the latest occurrence within two median cycles of
 *   today, so cancelled subscriptions go quiet.</li>
 * </ul>
 *
 * <p>All date arithmetic is UTC end-to-end; the client renders the returned
 * instants and day-of-month hint verbatim instead of re-deriving them. Every
 * surfaced number is an estimate.</p>
 */
@Service
public class RecurringPaymentService {

    /** Length of the analyzed history window. See class Javadoc for why. */
    static final int HISTORY_DAYS = 365;

    /** Collapsed occurrences required before any series is considered. */
    static final int MIN_OCCURRENCES = 3;

    /** Fraction of intervals that must sit inside the chosen cadence band. */
    static final double MIN_IN_BAND_RATIO = 0.70;

    /** In-band fraction required for HIGH confidence. */
    static final double HIGH_IN_BAND_RATIO = 0.80;

    /** Allowed amount variation (std/mean) for MEDIUM / HIGH confidence. */
    static final double MAX_AMOUNT_CV_MEDIUM = 0.30;
    static final double MAX_AMOUNT_CV_HIGH = 0.15;

    /** Occurrences required for HIGH confidence. */
    static final int HIGH_MIN_OCCURRENCES = 4;

    /** Maximum bills surfaced, soonest first. */
    static final int MAX_SURFACED = 12;

    /** Most recent matches attached for the detail experience. */
    static final int MAX_MATCHED_SHOWN = 8;

    private final TransactionRepository transactionRepository;

    public RecurringPaymentService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    /**
     * Detects recurring payments for the authenticated user from the last
     * {@value #HISTORY_DAYS} days of expenses.
     *
     * <p>Cached per user (Redis, TTL 15 min) — the most expensive read in the
     * app (a full year of expense history analyzed in memory). Because the
     * detection depends on the wall clock, the TTL — not only explicit
     * eviction — bounds staleness; every transaction mutation evicts via
     * {@link FinancialCacheInvalidator}.</p>
     */
    @Cacheable(cacheNames = CacheConfig.RECURRING_PAYMENTS_CACHE, key = "#authenticatedUser?.userId()")
    public Data detectForAuthenticatedUser(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new IllegalStateException("Authenticated user is required");
        }
        Instant now = Instant.now();
        List<Transaction> expenses = transactionRepository
                .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(
                        authenticatedUser.userId(), TransactionType.EXPENSE,
                        now.minus(Duration.ofDays(HISTORY_DAYS)));
        return new Data(detect(expenses, now));
    }

    /**
     * Pure detection entry point — deterministic given the same inputs and
     * {@code now}, which makes the algorithm unit-testable without a database.
     */
    List<Item> detect(List<Transaction> expenses, Instant now) {
        Map<String, List<Transaction>> groups = new LinkedHashMap<>();
        for (Transaction t : expenses) {
            if (t == null || t.getType() != TransactionType.EXPENSE || t.getAmount() <= 0 || t.isTransfer()) {
                continue; // income / transfer / refund-shaped rows can never form a bill
            }
            String key = normalizeMerchant(t.getName());
            if (!key.isEmpty()) {
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
            }
        }

        List<Item> detected = new ArrayList<>();
        for (Map.Entry<String, List<Transaction>> group : groups.entrySet()) {
            detectSeries(group.getKey(), group.getValue(), now).ifPresent(detected::add);
        }
        detected.sort(Comparator.comparing(Item::nextExpectedDate));
        return detected.size() > MAX_SURFACED ? new ArrayList<>(detected.subList(0, MAX_SURFACED)) : detected;
    }

    // ── Merchant normalization ─────────────────────────────────────────────

    /** Payment-processor / gateway prefixes that carry no merchant identity. */
    private static final java.util.Set<String> PROCESSOR_TOKENS = java.util.Set.of(
            "SQ", "SQP", "SQUARE", "TST", "WPY", "PAYPAL", "POS", "PAY",
            "PURCHASE", "DEBIT", "RECURRING");

    /** Corporate/legal suffixes that fragment otherwise identical merchants. */
    private static final java.util.Set<String> GENERIC_TOKENS = java.util.Set.of(
            "COM", "NET", "ORG", "INC", "LLC", "LTD", "CORP", "CO");

    /**
     * Collapses raw statement noise into a stable grouping key: upper-case,
     * processor prefixes stripped, digits/punctuation/reference junk removed,
     * whitespace collapsed. Deterministic and order-independent.
     */
    static String normalizeMerchant(String raw) {
        if (raw == null) {
            return "";
        }
        String name = raw.toUpperCase(Locale.ROOT).trim();

        // Strip leading processor tokens ("SQ * COFFEE", "PAYPAL * SHOP").
        boolean stripped = true;
        while (stripped) {
            stripped = false;
            for (String token : PROCESSOR_TOKENS) {
                if (name.startsWith(token + " ") || name.startsWith(token + "*")) {
                    name = name.substring(token.length() + 1).trim();
                    stripped = true;
                }
            }
            while (name.startsWith("*") || name.startsWith("#") || name.startsWith("-")) {
                name = name.substring(1).trim();
                stripped = true;
            }
        }

        // Drop digits, punctuation and separators; keep A-Z and spaces.
        StringBuilder sb = new StringBuilder(name.length());
        for (char c : name.toCharArray()) {
            if ((c >= 'A' && c <= 'Z') || c == ' ') {
                sb.append(c);
            } else {
                sb.append(' ');
            }
        }
        // Remove generic tokens ("NETFLIX COM" → "NETFLIX") so legal-form and
        // domain suffixes don't fragment one merchant into several groups.
        String[] tokens = sb.toString().trim().split("\\s+");
        List<String> kept = new ArrayList<>(tokens.length);
        for (String token : tokens) {
            if (!token.isEmpty() && !GENERIC_TOKENS.contains(token)) {
                kept.add(token);
            }
        }
        return String.join(" ", kept);
    }

    /** Display name: most frequent raw variant, earliest-seen as tie-break. */
    private static String pickDisplayName(List<Transaction> occurrences) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Transaction t : occurrences) {
            String raw = t.getName() == null ? "" : t.getName().trim();
            if (!raw.isEmpty()) {
                counts.merge(raw, 1, Integer::sum);
            }
        }
        String best = null;
        int bestCount = -1;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > bestCount) {
                best = e.getKey();
                bestCount = e.getValue();
            }
        }
        return best != null ? best : "Unknown merchant";
    }

    // ── Series detection ───────────────────────────────────────────────────

    /**
     * Attempts to promote one merchant group to a recurring series.
     * Transactions arrive in ascending date order from the repository.
     */
    private Optional<Item> detectSeries(String seriesKey, List<Transaction> group, Instant now) {
        List<Transaction> occurrences = collapseNearDuplicates(group);
        if (occurrences.size() < MIN_OCCURRENCES) {
            return Optional.empty();
        }

        // Consecutive gaps in whole days between occurrences.
        List<Long> intervals = new ArrayList<>();
        for (int i = 1; i < occurrences.size(); i++) {
            long days = Duration.between(
                    truncatedToDay(occurrences.get(i - 1).getDate()),
                    truncatedToDay(occurrences.get(i).getDate())).toDays();
            intervals.add(days);
        }

        CadenceFit fit = bestCadence(intervals);
        if (fit == null || fit.inBandRatio() < MIN_IN_BAND_RATIO) {
            return Optional.empty(); // no temporal rhythm → repeated shopping, not a bill
        }

        double[] amounts = occurrences.stream().mapToDouble(Transaction::getAmount).toArray();
        double mean = mean(amounts);
        if (mean <= 0) {
            return Optional.empty();
        }
        double cv = clampedCoefficientOfVariation(amounts);
        if (cv > MAX_AMOUNT_CV_MEDIUM) {
            return Optional.empty(); // amounts too erratic — variable baskets, not bills
        }

        Transaction last = occurrences.get(occurrences.size() - 1);
        long medianInterval = Math.round(fit.medianInBandDays());

        // Dormancy: nothing within two cycles of today means the series died.
        Instant dormancyLimit = last.getDate().plus(Duration.ofDays(2 * medianInterval + 2));
        if (dormancyLimit.isBefore(now)) {
            return Optional.empty();
        }

        boolean highConfidence = occurrences.size() >= HIGH_MIN_OCCURRENCES
                && fit.inBandRatio() >= HIGH_IN_BAND_RATIO
                && cv <= MAX_AMOUNT_CV_HIGH;

        Instant nextDate = projectNext(last.getDate(), medianInterval, now);

        Integer usualDay = "MONTHLY".equals(fit.cadence())
                ? modeDayOfMonth(occurrences)
                : null;

        AmountChange change = amountChange(amounts);

        List<MatchedTransaction> matches = new ArrayList<>();
        int fromIndex = Math.max(0, occurrences.size() - MAX_MATCHED_SHOWN);
        for (Transaction t : occurrences.subList(fromIndex, occurrences.size())) {
            matches.add(new MatchedTransaction(t.getId(), t.getDate().toString(), t.getAmount()));
        }

        return Optional.of(new Item(
                seriesKey,
                pickDisplayName(occurrences),
                round2(last.getAmount()),
                last.getBaseCurrency() == null ? "USD" : last.getBaseCurrency(),
                fit.cadence(),
                (int) medianInterval,
                nextDate.toString(),
                last.getDate().toString(),
                occurrences.size(),
                highConfidence ? "HIGH" : "MEDIUM",
                usualDay,
                change,
                matches));
    }

    // ── Cadence classification ─────────────────────────────────────────────

    /**
     * A cadence hypothesis evaluated against the observed day-gaps.
     *
     * @param inBandRatio      fraction of gaps explained (in band or skipped cycle)
     * @param medianInBandDays median of the in-band gaps (the cycle length)
     */
    private record CadenceFit(String cadence, double inBandRatio, double medianInBandDays) {
    }

    /**
     * Evaluates every supported cadence and returns the best fit, or null when
     * no cadence explains the data. A gap counts as a "skipped cycle" — not
     * irregularity — when it sits at roughly twice the cadence, so real life
     * (a skipped gym month) does not disqualify an otherwise steady bill.
     */
    static CadenceFit bestCadence(List<Long> intervals) {
        if (intervals.size() < MIN_OCCURRENCES - 1) {
            return null;
        }
        String[][] bands = {
                { "WEEKLY", "6", "9" },
                { "BIWEEKLY", "11", "17" },
                { "MONTHLY", "24", "35" },
                { "QUARTERLY", "80", "100" },
        };
        CadenceFit best = null;
        for (String[] band : bands) {
            long low = Long.parseLong(band[1]);
            long high = Long.parseLong(band[2]);
            List<Long> inBand = new ArrayList<>();
            int skipped = 0;
            for (long d : intervals) {
                if (d >= low && d <= high) {
                    inBand.add(d);
                } else if (d >= 2 * low && d <= 2 * high + 4) {
                    skipped++; // one missed cycle at this cadence
                }
            }
            int explained = inBand.size() + skipped;
            double ratio = intervals.isEmpty() ? 0 : (double) explained / intervals.size();
            if (ratio <= 0 || inBand.isEmpty()) {
                continue;
            }
            if (best == null || ratio > best.inBandRatio()
                    || (ratio == best.inBandRatio() && inBand.size() > countInBand(best))) {
                inBand.sort(Comparator.naturalOrder());
                double median = inBand.get(inBand.size() / 2);
                if (inBand.size() % 2 == 0) {
                    median = (inBand.get(inBand.size() / 2 - 1) + median) / 2.0;
                }
                best = new CadenceFit(band[0], ratio, median);
            }
        }
        return best;
    }

    /** Tie-break proxy: shorter cadences explain more gaps; prefer them last. */
    private static int countInBand(CadenceFit fit) {
        return switch (fit.cadence()) {
            case "WEEKLY" -> 1;
            case "BIWEEKLY" -> 2;
            case "MONTHLY" -> 3;
            default -> 4;
        };
    }

    // ── Duplicate collapse ─────────────────────────────────────────────────

    /**
     * Merges same-merchant charges landing within a day of each other with a
     * matching amount (auth+capture doubles, accidental double posts). Keeps
     * the earliest of each cluster. Genuine distinct purchases on nearby days
     * differ in amount or rhythm and survive.
     */
    static List<Transaction> collapseNearDuplicates(List<Transaction> group) {
        List<Transaction> sorted = new ArrayList<>(group);
        sorted.sort(Comparator.comparing(Transaction::getDate));
        List<Transaction> collapsed = new ArrayList<>();
        for (Transaction t : sorted) {
            boolean duplicate = false;
            for (Transaction kept : collapsed) {
                long days = Duration.between(
                        truncatedToDay(kept.getDate()), truncatedToDay(t.getDate())).toDays();
                double tolerance = Math.max(0.01, Math.abs(t.getAmount()) * 0.02);
                if (days <= 1 && Math.abs(kept.getAmount() - t.getAmount()) <= tolerance) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                collapsed.add(t);
            }
        }
        return collapsed;
    }

    /** Steps forward one median cycle at a time until strictly after {@code now}. */
    static Instant projectNext(Instant last, long intervalDays, Instant now) {
        Instant next = last.plus(Duration.ofDays(intervalDays));
        while (!next.isAfter(now)) {
            next = next.plus(Duration.ofDays(intervalDays));
        }
        return next;
    }

    /** Most common UTC day-of-month across occurrences; latest wins ties. */
    static Integer modeDayOfMonth(List<Transaction> occurrences) {
        Map<Integer, Integer> counts = new LinkedHashMap<>();
        for (Transaction t : occurrences) {
            int dom = t.getDate().atZone(ZoneOffset.UTC).getDayOfMonth();
            counts.merge(dom, 1, Integer::sum);
        }
        Integer best = null;
        int bestCount = -1;
        for (Map.Entry<Integer, Integer> e : counts.entrySet()) {
            if (e.getValue() > bestCount) {
                best = e.getKey();
                bestCount = e.getValue();
            }
        }
        return best;
    }

    /**
     * Detects a meaningful price change: latest vs median of everything before
     * it, ignoring sub-dollar / sub-10% movement so rounding never triggers.
     */
    static AmountChange amountChange(double[] amountsAscending) {
        if (amountsAscending.length < 2) {
            return null;
        }
        double[] prior = java.util.Arrays.copyOfRange(
                amountsAscending, 0, amountsAscending.length - 1);
        double previous = median(prior);
        double current = amountsAscending[amountsAscending.length - 1];
        double delta = Math.abs(current - previous);
        if (delta <= 1.00 || delta <= previous * 0.10) {
            return null;
        }
        return new AmountChange(round2(previous), round2(current));
    }

    /**
     * Std/mean with sub-dollar AND sub-1% deviations clamped to zero first —
     * "$10.99 most months, $11.00 once" is stability, not variance.
     */
    static double clampedCoefficientOfVariation(double[] amounts) {
        double avg = mean(amounts);
        if (avg <= 0) {
            return Double.MAX_VALUE;
        }
        double clampTolerance = Math.max(1.00, avg * 0.01);
        double sumSquares = 0;
        for (double a : amounts) {
            double dev = Math.abs(a - avg);
            if (dev <= clampTolerance) {
                dev = 0;
            }
            sumSquares += dev * dev;
        }
        double std = Math.sqrt(sumSquares / amounts.length);
        return std / avg;
    }

    private static double mean(double[] values) {
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return values.length == 0 ? 0 : sum / values.length;
    }

    private static double median(double[] values) {
        double[] sorted = java.util.Arrays.copyOf(values, values.length);
        java.util.Arrays.sort(sorted);
        int mid = sorted.length / 2;
        return sorted.length % 2 == 1
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2.0;
    }

    private static Instant truncatedToDay(Instant instant) {
        return instant.truncatedTo(java.time.temporal.ChronoUnit.DAYS);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}