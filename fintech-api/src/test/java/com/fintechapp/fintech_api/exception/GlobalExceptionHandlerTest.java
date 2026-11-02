package com.fintechapp.fintech_api.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fintechapp.fintech_api.security.TokenAuthenticationException;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void returnsConfiguredStatusForTokenAuthenticationException() throws Exception {
        mockMvc.perform(get("/test-errors/token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid token."));
    }

    @Test
    void returnsBadRequestForIllegalArgumentException() throws Exception {
        mockMvc.perform(get("/test-errors/illegal-argument"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid amount."));
    }

    @Test
    void returnsBadRequestForUnreadableJsonPayload() throws Exception {
        mockMvc.perform(post("/test-errors/payload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid request payload."));
    }

    @Test
    void returnsInternalServerErrorForUnhandledException() throws Exception {
        mockMvc.perform(get("/test-errors/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred."));
    }

    @Test
    void returnsConflictForStaleAccountUpdates() throws Exception {
        mockMvc.perform(get("/test-errors/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Account changed. Please reload and try again."));
    }

    @RestController
    @RequestMapping("/test-errors")
    static class TestController {

        @GetMapping("/conflict")
        String conflict() {
            throw new org.springframework.dao.OptimisticLockingFailureException("Stale account");
        }

        @GetMapping("/token")
        String token() {
            throw new TokenAuthenticationException(HttpStatus.UNAUTHORIZED, "Invalid token.");
        }

        @GetMapping("/illegal-argument")
        String illegalArgument() {
            throw new IllegalArgumentException("Invalid amount.");
        }

        @PostMapping("/payload")
        String payload(@RequestBody PayloadRequest request) {
            return request.amount();
        }

        @GetMapping("/unexpected")
        String unexpected() {
            throw new RuntimeException("Boom");
        }
    }

    record PayloadRequest(String amount) {
    }
}

