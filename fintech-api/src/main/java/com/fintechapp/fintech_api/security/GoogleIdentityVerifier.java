package com.fintechapp.fintech_api.security;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;
import java.util.Locale;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GoogleIdentityVerifier {
    public record Identity(String subject, String email, String name, boolean authoritativeEmail) { }
    private final GoogleIdTokenVerifier verifier;
    private final String clientId;

    @Autowired
    public GoogleIdentityVerifier(@Value("${GOOGLE_ANDROID_CLIENT_ID:}") String clientId) {
        this(new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(List.of(clientId)).build(), clientId);
    }

    GoogleIdentityVerifier(GoogleIdTokenVerifier verifier, String clientId) {
        this.verifier = verifier;
        this.clientId = clientId;
    }

    public Identity verify(String rawToken) {
        if (!StringUtils.hasText(clientId)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is not configured.");
        }
        if (!StringUtils.hasText(rawToken) || rawToken.length() > 16384) throw invalid();
        GoogleIdToken token;
        try {
            token = GoogleIdToken.parse(verifier.getJsonFactory(), rawToken);
        } catch (IOException | IllegalArgumentException error) {
            throw invalid();
        }
        try {
            var payload = token.getPayload();
            if (payload.getExpirationTimeSeconds() == null || payload.getIssuedAtTimeSeconds() == null
                    || payload.getIssuer() == null || payload.getAudience() == null) throw invalid();
            // Google's verifier checks signature, issuer, audience, expiry and issued-at.
            if (!verifier.verify(token)) throw invalid();
            return claims(token.getPayload());
        } catch (GeneralSecurityException | IllegalArgumentException error) {
            throw invalid();
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is temporarily unavailable.");
        }
    }

    private Identity claims(GoogleIdToken.Payload payload) {
        String subject = payload.getSubject();
        String email = payload.getEmail();
        if (!StringUtils.hasText(subject) || subject.length() > 255 || !subject.matches("[\\x21-\\x7E]+")
                || !Boolean.TRUE.equals(payload.getEmailVerified()) || !StringUtils.hasText(email)) throw invalid();
        email = email.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 255 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw invalid();
        String domain = email.substring(email.lastIndexOf('@') + 1);
        Object hostedDomain = payload.get("hd");
        // A third-party Google email claim alone is never current mailbox proof.
        boolean authoritative = domain.equals("gmail.com")
                || hostedDomain instanceof String hd && hd.equalsIgnoreCase(domain);
        Object rawName = payload.get("name");
        String name = rawName instanceof String value && !value.isBlank() ? value.trim() : email;
        if (name.length() > 255) name = name.substring(0, 255);
        return new Identity(subject, email, name, authoritative);
    }

    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google identity token.");
    }
}
