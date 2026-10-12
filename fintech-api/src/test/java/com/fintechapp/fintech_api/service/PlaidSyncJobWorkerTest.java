package com.fintechapp.fintech_api.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class PlaidSyncJobWorkerTest {
    @Mock private PlaidSyncJobService jobs;
    @Mock private PlaidTransactionSyncService sync;
    @Mock private TaskExecutor executor;
    private PlaidSyncJobWorker worker;
    private final PlaidSyncJobService.JobClaim claim =
            new PlaidSyncJobService.JobClaim("item-1", 3, 2, "lease-owner");

    @BeforeEach
    void setUp() {
        worker = new PlaidSyncJobWorker(jobs, sync, executor, 2);
        when(jobs.claimNext()).thenReturn(Optional.of(claim), Optional.empty());
        doAnswer(invocation -> {
            ((Runnable) invocation.getArgument(0)).run();
            return null;
        }).when(executor).execute(any(Runnable.class));
    }

    @Test
    void successfulSyncCompletesOnlyAfterSyncReturns() {
        worker.processOne();
        verify(sync).syncItem(eq("item-1"), any());
        verify(jobs).complete(claim);
        verify(jobs, never()).retry(any(), any());
    }

    @Test
    void transientPlaidFailureSchedulesRetry() {
        doThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "temporary upstream failure"))
                .when(sync).syncItem(eq("item-1"), any());
        worker.processOne();
        verify(jobs).retry(claim, "RESPONSESTATUSEXCEPTION");
        verify(jobs, never()).fail(any(), any());
    }

    @Test
    void permanentPlaidFailureIsTerminal() {
        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plaid error INVALID_INPUT: invalid"))
                .when(sync).syncItem(eq("item-1"), any());
        worker.processOne();
        verify(jobs).fail(claim, "INVALID_INPUT");
        verify(jobs, never()).retry(any(), any());
    }

    @Test
    void invalidAccessTokenTransitionsToActionRequired() {
        doThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Plaid error ITEM_LOGIN_REQUIRED: reauth"))
                .when(sync).syncItem(eq("item-1"), any());
        worker.processOne();
        verify(jobs).requireAction(claim, "ITEM_LOGIN_REQUIRED");
        verify(jobs, never()).retry(any(), any());
    }
}
