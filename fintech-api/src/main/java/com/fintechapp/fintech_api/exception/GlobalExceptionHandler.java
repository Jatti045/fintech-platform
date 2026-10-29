package com.fintechapp.fintech_api.exception;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.common.ApiErrorResponse;
import com.fintechapp.fintech_api.security.TokenAuthenticationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(TokenAuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleTokenAuthenticationException(TokenAuthenticationException exception) {
        HttpStatus status = Objects.requireNonNullElse(exception.getStatus(), HttpStatus.UNAUTHORIZED);
        return errorResponse(status, exception.getMessage(), exception);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(fieldError -> {
            String defaultMessage = Objects.requireNonNullElse(fieldError.getDefaultMessage(), "Invalid value");
            fieldErrors.putIfAbsent(fieldError.getField(), defaultMessage);
        });

        return errorResponse(HttpStatus.BAD_REQUEST, "Request validation failed.", fieldErrors, exception);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleHttpMessageNotReadable(HttpMessageNotReadableException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, "Invalid request payload.", exception);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, "File too large. Maximum file size is 5MB.", exception);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiErrorResponse> handleMultipartException(MultipartException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, "Invalid multipart request.", exception);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        String message = exception.getMessage() != null ? exception.getMessage() : "Invalid request.";
        return errorResponse(HttpStatus.BAD_REQUEST, message, exception);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatusException(ResponseStatusException exception) {
        HttpStatus status = exception.getStatusCode() instanceof HttpStatus httpStatus
                ? httpStatus
                : HttpStatus.BAD_REQUEST;
        String message = exception.getReason() != null ? exception.getReason() : "Request failed.";
        return errorResponse(status, message, exception);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException exception) {
        String message = "Request method '%s' is not supported for this endpoint."
                .formatted(exception.getMethod());
        return errorResponse(HttpStatus.METHOD_NOT_ALLOWED, message, exception);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoResourceFoundException(NoResourceFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, "Endpoint not found.", exception);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiErrorResponse> handleOptimisticLock(OptimisticLockingFailureException exception) {
        return errorResponse(HttpStatus.CONFLICT, "Account changed. Please reload and try again.", exception);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(Exception exception) {
        return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", exception);
    }

    private ResponseEntity<ApiErrorResponse> errorResponse(HttpStatus status, String message, Exception exception) {
        return errorResponse(status, message, Map.of(), exception);
    }

    private ResponseEntity<ApiErrorResponse> errorResponse(
            HttpStatus status,
            String message,
            Map<String, String> fieldErrors,
            Exception exception) {
        logger.error("Request failed with status {}: {}", status.value(), message, exception);
        return ResponseEntity.status(status).body(new ApiErrorResponse(message, fieldErrors));
    }
}
