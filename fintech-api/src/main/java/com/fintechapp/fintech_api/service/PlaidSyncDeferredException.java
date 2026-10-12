package com.fintechapp.fintech_api.service;

/** Signals that a worker attempt did not finish and must remain recoverable. */
public class PlaidSyncDeferredException extends RuntimeException {
    private final String code;

    public PlaidSyncDeferredException(String code) {
        super(code);
        this.code = code;
    }

    public PlaidSyncDeferredException(String code, Throwable cause) {
        super(code, cause);
        this.code = code;
    }

    public String code() { return code; }
}
