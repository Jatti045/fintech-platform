package com.fintechapp.fintech_api.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Plaid requires the entire pagination sequence to restart from its input cursor. */
public class PlaidPaginationMutationException extends ResponseStatusException {
    public PlaidPaginationMutationException() {
        super(HttpStatus.BAD_GATEWAY, "Plaid error TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
    }
}
