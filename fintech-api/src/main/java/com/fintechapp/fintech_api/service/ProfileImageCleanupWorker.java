package com.fintechapp.fintech_api.service;

import java.util.concurrent.Semaphore;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ProfileImageCleanupWorker {
    private static final Logger logger = LoggerFactory.getLogger(ProfileImageCleanupWorker.class);
    private final ProfileImageCleanupJobs jobs;
    private final CloudinaryService cloudinary;
    private final TaskExecutor executor;
    private final Semaphore slot = new Semaphore(1);

    public ProfileImageCleanupWorker(ProfileImageCleanupJobs jobs, CloudinaryService cloudinary,
            @Qualifier("profileImageCleanupExecutor") TaskExecutor executor) {
        this.jobs = jobs;
        this.cloudinary = cloudinary;
        this.executor = executor;
    }

    @Scheduled(fixedDelayString = "${app.profile-cleanup.worker-poll-ms:1000}",
            initialDelayString = "${app.profile-cleanup.initial-delay-ms:10000}")
    public void processOne() {
        if (!slot.tryAcquire()) return;
        ProfileImageCleanupJobs.Claim claim = null;
        try {
            claim = jobs.claimNext().orElse(null);
            if (claim == null) {
                slot.release();
                return;
            }
            var work = claim;
            executor.execute(() -> process(work));
        } catch (RuntimeException ex) {
            slot.release();
            if (claim != null) retry(claim);
            else logger.warn("Could not claim profile image cleanup work");
        }
    }

    private void process(ProfileImageCleanupJobs.Claim claim) {
        try {
            cloudinary.deleteImage(claim.publicId());
            jobs.complete(claim);
        } catch (RuntimeException ex) {
            retry(claim);
        } finally {
            slot.release();
        }
    }

    private void retry(ProfileImageCleanupJobs.Claim claim) {
        logger.warn("Profile image cleanup pending after attempt {}", claim.attempts());
        try {
            jobs.retry(claim);
        } catch (RuntimeException ex) {
            logger.warn("Could not persist profile image retry; lease recovery will retry");
        }
    }
}
