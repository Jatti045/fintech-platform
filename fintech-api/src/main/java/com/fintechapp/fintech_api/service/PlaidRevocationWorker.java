package com.fintechapp.fintech_api.service;

import java.util.concurrent.Semaphore;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Uses the existing bounded-executor/leased-job pattern, with HTTP outside database transactions. */
@Component
public class PlaidRevocationWorker {
    private static final Logger logger = LoggerFactory.getLogger(PlaidRevocationWorker.class);
    private final PlaidRevocationJobService jobs;
    private final PlaidRevocationClient client;
    private final TaskExecutor executor;
    private final Semaphore slot = new Semaphore(1);

    public PlaidRevocationWorker(PlaidRevocationJobService jobs, PlaidRevocationClient client,
            @Qualifier("plaidRevocationExecutor") TaskExecutor executor) {
        this.jobs = jobs;
        this.client = client;
        this.executor = executor;
    }

    @Scheduled(fixedDelayString = "${app.plaid.revocation.worker-poll-ms:1000}",
            initialDelayString = "${app.plaid.revocation.initial-delay-ms:10000}")
    public void processOne() {
        if (!slot.tryAcquire()) return;
        PlaidRevocationJobService.Claim claim;
        try {
            claim = jobs.claimNext().orElse(null);
        } catch (RuntimeException ex) {
            slot.release();
            logger.error("Could not claim Plaid revocation job ({})", ex.getClass().getSimpleName());
            return;
        }
        if (claim == null) {
            slot.release();
            return;
        }
        try {
            executor.execute(() -> {
                try { process(claim); }
                finally { slot.release(); }
            });
        } catch (RuntimeException ex) {
            slot.release();
            retry(claim, "EXECUTOR_REJECTED");
        }
    }

    private void process(PlaidRevocationJobService.Claim claim) {
        try {
            client.revoke(claim.encryptedToken());
            if (jobs.complete(claim)) logger.info("Confirmed Plaid revocation; credentials erased job_id={}", claim.id());
        } catch (RuntimeException ex) {
            String code = ex instanceof PlaidRevocationClient.Failure ? ex.getMessage() : "REVOCATION_WORKER_ERROR";
            // Lease recovery also handles persistence failures or process loss here.
            boolean scheduled = retry(claim, code);
            logger.warn("Plaid revocation pending job_id={} attempt={} code={} retry_scheduled={}",
                    claim.id(), claim.attemptCount(), code, scheduled);
            if (claim.attemptCount() >= 8) {
                logger.error("Plaid revocation needs operator attention job_id={} code={}; retries continue", claim.id(), code);
            }
        }
    }

    private boolean retry(PlaidRevocationJobService.Claim claim, String code) {
        try {
            return jobs.retry(claim, code);
        } catch (RuntimeException ex) {
            logger.error("Could not persist Plaid revocation retry job_id={} ({}); lease recovery will retry",
                    claim.id(), ex.getClass().getSimpleName());
            return false;
        }
    }
}
