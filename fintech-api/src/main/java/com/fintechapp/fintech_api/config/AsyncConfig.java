package com.fintechapp.fintech_api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.core.task.TaskExecutor;

/**
 * Enables scheduled durable-job polling and provides bounded execution capacity.
 */
@Configuration
@EnableScheduling
public class AsyncConfig {

    // Remote cleanup must keep progressing even when every sync worker is busy.
    @Bean(name = "plaidRevocationExecutor")
    public TaskExecutor plaidRevocationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("plaid-revocation-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "recoveryEmailExecutor")
    public TaskExecutor recoveryEmailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("recovery-email-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "plaidSyncWorkerExecutor")
    public TaskExecutor plaidSyncWorkerExecutor(@Value("${app.plaid.sync.worker-concurrency:2}") int concurrency) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int poolSize = Math.max(1, concurrency);
        executor.setCorePoolSize(poolSize);
        executor.setMaxPoolSize(poolSize);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("plaid-sync-");
        executor.initialize();
        return executor;
    }
}
