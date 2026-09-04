package com.fintechapp.fintech_api.ai;

/**
 * Raised when the AI provider cannot produce a usable completion. Carries only
 * a coarse {@code kind} — never raw provider payloads, which must not reach
 * clients or logs.
 */
public class AiClientException extends RuntimeException {

    public enum Kind {
        /** Missing/incomplete provider configuration. */
        NOT_CONFIGURED,
        /** Provider unreachable, errored, timed out, or returned unusable output. */
        PROVIDER_FAILURE
    }

    private final Kind kind;

    public AiClientException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public AiClientException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind getKind() {
        return kind;
    }
}
