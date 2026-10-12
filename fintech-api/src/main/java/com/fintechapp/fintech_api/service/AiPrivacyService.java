package com.fintechapp.fintech_api.service;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.AiPrivacyResponse;
import com.fintechapp.fintech_api.dto.user.UpdateAiPrivacyRequest;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.UserRepository;

@Service
public class AiPrivacyService {
    public static final String DISCLOSURE_VERSION = "1";
    private final UserRepository users;
    private final String providerName;
    private final String privacyPolicyUrl;

    public AiPrivacyService(UserRepository users,
            @Value("${app.ai.public-provider-name:external AI provider}") String providerName,
            @Value("${app.ai.public-privacy-policy-url:}") String privacyPolicyUrl) {
        this.users = users;
        this.providerName = providerName;
        this.privacyPolicyUrl = privacyPolicyUrl.startsWith("https://") ? privacyPolicyUrl : null;
    }

    @Transactional(readOnly = true)
    public AiPrivacyResponse get(AuthenticatedUser auth) {
        return response(users.findById(userId(auth)).orElseThrow(() -> unauthorized()));
    }

    @Transactional
    public AiPrivacyResponse update(AuthenticatedUser auth, UpdateAiPrivacyRequest request) {
        if (request.enabled() == null || request.enabled() && !DISCLOSURE_VERSION.equals(request.disclosureVersion())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please review the current AI privacy disclosure.");
        }
        User user = users.findByIdForUpdate(userId(auth)).orElseThrow(() -> unauthorized());
        user.setAiProcessingEnabled(request.enabled());
        if (request.enabled()) user.setAiConsentVersion(DISCLOSURE_VERSION);
        user.setAiConsentUpdatedAt(Instant.now());
        return response(user);
    }

    private AiPrivacyResponse response(User user) {
        boolean enabled = user.isAiProcessingEnabled() && DISCLOSURE_VERSION.equals(user.getAiConsentVersion());
        return new AiPrivacyResponse(true, "AI privacy preference loaded",
                new AiPrivacyResponse.Data(enabled, DISCLOSURE_VERSION, user.getAiConsentUpdatedAt(), providerName, privacyPolicyUrl));
    }

    private static String userId(AuthenticatedUser auth) {
        if (auth == null || auth.userId() == null || auth.userId().isBlank()) throw unauthorized();
        return auth.userId();
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
    }
}
