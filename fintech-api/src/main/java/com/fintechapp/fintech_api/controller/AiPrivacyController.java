package com.fintechapp.fintech_api.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.AiPrivacyResponse;
import com.fintechapp.fintech_api.dto.user.UpdateAiPrivacyRequest;
import com.fintechapp.fintech_api.service.AiPrivacyService;

@RestController
@RequestMapping("/api/users/me/ai-preference")
public class AiPrivacyController {
    private final AiPrivacyService privacy;
    public AiPrivacyController(AiPrivacyService privacy) { this.privacy = privacy; }
    @GetMapping
    public AiPrivacyResponse get(@AuthenticationPrincipal AuthenticatedUser auth) { return privacy.get(auth); }
    @PatchMapping
    public AiPrivacyResponse update(@AuthenticationPrincipal AuthenticatedUser auth,
            @Valid @RequestBody UpdateAiPrivacyRequest request) { return privacy.update(auth, request); }
}
