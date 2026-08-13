package com.fintechapp.fintech_api.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Enables Spring's {@code @Async} support and provides a dedicated executor
 * for background work.
 *
 * Plaid webhooks are acknowledged synchronously (so the HTTP thread returns
 * immediately with 200 OK) and the transaction ingestion is handed off to this
 * pool so network-bound /transactions/sync calls never block webhook replies.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "plaidTaskExecutor")
    public Executor plaidTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("plaid-sync-");
        executor.initialize();
        return executor;
    }
}
