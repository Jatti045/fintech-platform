package com.fintechapp.fintech_api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.fintechapp.fintech_api.model.FailedWebhook;

/** Loads {@link FailedWebhook} dead-letter rows for manual inspection. */
@Repository
public interface FailedWebhookRepository extends JpaRepository<FailedWebhook, String> {
}