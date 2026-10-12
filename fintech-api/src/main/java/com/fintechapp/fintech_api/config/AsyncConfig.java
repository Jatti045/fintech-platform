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
