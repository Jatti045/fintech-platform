package com.fintechapp.fintech_api.service;

import java.util.Locale;
import java.util.List;
import java.util.concurrent.Semaphore;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Claims durable jobs from PostgreSQL and executes them with lease fencing. */
@Component
public class PlaidSyncJobWorker {
    private static final Logger logger = LoggerFactory.getLogger(PlaidSyncJobWorker.class);
    private final PlaidSyncJobService jobs;
    private final PlaidTransactionSyncService sync;
    private final TaskExecutor executor;
    private final Semaphore slots;

    public PlaidSyncJobWorker(PlaidSyncJobService jobs, PlaidTransactionSyncService sync,
            @Qualifier("plaidSyncWorkerExecutor") TaskExecutor executor,
            @Value("${app.plaid.sync.worker-concurrency:2}") int concurrency) {
        this.jobs = jobs;
        this.sync = sync;
        this.executor = executor;
        this.slots = new Semaphore(Math.max(1, concurrency));
    }

    @Scheduled(fixedDelayString = "${app.plaid.sync.worker-poll-ms:500}",
            initialDelayString = "${app.plaid.sync.worker-initial-delay-ms:0}")
    public void processOne() {
        while (slots.tryAcquire()) {
            PlaidSyncJobService.JobClaim claim;
            try {
                claim = jobs.claimNext().orElse(null);
            } catch (RuntimeException ex) {
                slots.release();
                logger.error("Could not claim durable Plaid sync job ({})", ex.getClass().getSimpleName());
                return;
            }
            if (claim == null) {
                slots.release();
                return;
            }
            try {
                executor.execute(() -> {
                    try { process(claim); }
                    finally { slots.release(); }
                });
            } catch (RuntimeException rejected) {
                slots.release();
                jobs.retry(claim, "EXECUTOR_REJECTED");
                return;
            }
        }
    }

    private void process(PlaidSyncJobService.JobClaim claim) {
        logger.info("Claimed Plaid sync job item_id={} attempt={} generation={}",
                claim.itemId(), claim.attemptCount(), claim.claimedVersion());
        try {
            sync.syncItem(claim.itemId(), () -> {
                if (!jobs.renew(claim)) throw new PlaidSyncDeferredException("JOB_LEASE_LOST");
            });
            if (jobs.complete(claim)) {
                logger.info("Completed Plaid sync job item_id={} generation={}", claim.itemId(), claim.claimedVersion());
            } else {
                logger.warn("Plaid sync job completion fenced by newer owner item_id={}", claim.itemId());
            }
        } catch (RuntimeException ex) {
            String code = errorCode(ex);
            if (isActionRequired(ex)) {
                jobs.requireAction(claim, code);
                logger.warn("Plaid sync requires user action item_id={} code={}", claim.itemId(), code);
            } else if (isRetryable(ex)) {
                boolean retrying = jobs.retry(claim, code);
                logger.warn("Plaid sync attempt failed item_id={} code={} retrying={}", claim.itemId(), code, retrying);
            } else {
                jobs.fail(claim, code);
                logger.error("Plaid sync permanently failed item_id={} code={}", claim.itemId(), code);
            }
        }
    }

    private static boolean isActionRequired(Throwable failure) {
        String text = failureText(failure);
        return text.contains("ITEM_LOGIN_REQUIRED") || text.contains("INVALID_ACCESS_TOKEN");
    }

    private static boolean isRetryable(Throwable failure) {
        if (failure instanceof PlaidSyncDeferredException) return true;
        if (failure instanceof TransientDataAccessException || failure instanceof java.sql.SQLTransientException) return true;
        String text = failureText(failure);
        if (text.contains("Plaid error ") && List.of("INVALID_API_KEYS", "INVALID_CLIENT_ID", "INVALID_REQUEST",
                "INVALID_INPUT", "ITEM_NOT_FOUND", "PRODUCT_NOT_READY", "INVALID_PRODUCT")
                .stream().anyMatch(text::contains)) return false;
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current instanceof ResponseStatusException response) {
                HttpStatusCode status = response.getStatusCode();
                return status.value() == 429 || status.is5xxServerError();
            }
        }
        return failure instanceof java.io.IOException || failure instanceof java.util.concurrent.TimeoutException;
    }

    private static String errorCode(Throwable failure) {
        if (failure instanceof PlaidSyncDeferredException deferred) return deferred.code();
        String text = failureText(failure);
        int marker = text.indexOf("Plaid error ");
        if (marker >= 0) {
            String value = text.substring(marker + 12).split(":", 2)[0];
            return value.replaceAll("[^A-Za-z0-9_-]", "_");
        }
        return failure.getClass().getSimpleName().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
    }

    private static String failureText(Throwable failure) {
        StringBuilder text = new StringBuilder();
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current.getMessage() != null) text.append(current.getMessage()).append(' ');
        }
        return text.toString();
    }
}
