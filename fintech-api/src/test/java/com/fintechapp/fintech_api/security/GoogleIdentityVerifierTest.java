package com.fintechapp.fintech_api.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.auth.oauth2.GooglePublicKeysManager;
import com.google.api.client.json.gson.GsonFactory;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class GoogleIdentityVerifierTest {
    private static final String CLIENT = "application-client";
    private KeyPair signingKey;
    private GoogleIdentityVerifier verifier;

    @BeforeEach void setup() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        signingKey = generator.generateKeyPair();
        var keys = mock(GooglePublicKeysManager.class);
        when(keys.getJsonFactory()).thenReturn(new GsonFactory());
        when(keys.getPublicKeys()).thenReturn(List.of(signingKey.getPublic()));
        var sdk = new GoogleIdTokenVerifier.Builder(keys).setAudience(List.of(CLIENT)).build();
        verifier = new GoogleIdentityVerifier(sdk, CLIENT);
    }

    private JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().issuer("https://accounts.google.com").audience(CLIENT)
                .subject("stable-subject").issueTime(Date.from(Instant.now()))
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                .claim("email", "person@gmail.com").claim("email_verified", true).claim("name", "Person");
    }
    private String token(JWTClaimsSet.Builder claims) throws Exception { return token(claims, signingKey); }
    private String token(JWTClaimsSet.Builder claims, KeyPair key) throws Exception {
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims.build());
        jwt.sign(new RSASSASigner((RSAPrivateKey) key.getPrivate())); return jwt.serialize();
    }
    private void rejected(JWTClaimsSet.Builder claims) throws Exception {
        String signed = token(claims);
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> verifier.verify(signed)).getStatusCode().value());
    }

    @Test void acceptsCryptographicallyVerifiedGmailIdentity() throws Exception {
        var identity = verifier.verify(token(claims()));
        assertEquals("stable-subject", identity.subject()); assertEquals("person@gmail.com", identity.email());
        assertTrue(identity.authoritativeEmail());
    }
    @Test void acceptsMatchingVerifiedWorkspaceAuthority() throws Exception {
        assertTrue(verifier.verify(token(claims().claim("email", "person@company.example").claim("hd", "company.example"))).authoritativeEmail());
    }
    @Test void thirdPartyAndMismatchedHostedDomainRequireMailboxProof() throws Exception {
        assertFalse(verifier.verify(token(claims().claim("email", "person@external.example"))).authoritativeEmail());
        assertFalse(verifier.verify(token(claims().claim("email", "person@external.example").claim("hd", "other.example"))).authoritativeEmail());
    }
    @Test void missingProfileNameFallsBackToEmail() throws Exception {
        assertEquals("person@gmail.com", verifier.verify(token(claims().claim("name", null))).name());
    }
    @Test void rejectsUnverifiedEmail() throws Exception { rejected(claims().claim("email_verified", false)); }
    @Test void rejectsMissingEmailVerification() throws Exception { rejected(claims().claim("email_verified", null)); }
    @Test void rejectsMissingEmail() throws Exception { rejected(claims().claim("email", null)); }
    @Test void rejectsMalformedEmail() throws Exception { rejected(claims().claim("email", "bad@@example.com")); }
    @Test void rejectsMissingSubject() throws Exception { rejected(claims().subject(null)); }
    @Test void rejectsWhitespaceSubject() throws Exception { rejected(claims().subject(" subject ")); }
    @Test void rejectsOversizedSubject() throws Exception { rejected(claims().subject("x".repeat(256))); }
    @Test void rejectsWrongAudience() throws Exception { rejected(claims().audience("other-client")); }
    @Test void rejectsWrongIssuer() throws Exception { rejected(claims().issuer("https://attacker.example")); }
    @Test void rejectsExpiredToken() throws Exception { rejected(claims().expirationTime(Date.from(Instant.now().minusSeconds(3600)))); }
    @Test void rejectsMissingExpiry() throws Exception { rejected(claims().expirationTime(null)); }
    @Test void rejectsMissingIssuedAt() throws Exception { rejected(claims().issueTime(null)); }
    @Test void rejectsMissingAudience() throws Exception { rejected(claims().audience((String) null)); }
    @Test void rejectsMissingIssuer() throws Exception { rejected(claims().issuer(null)); }
    @Test void rejectsFutureIssuedAt() throws Exception { rejected(claims().issueTime(Date.from(Instant.now().plusSeconds(3600)))); }
    @Test void rejectsForgedSignature() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        String forged = token(claims(), generator.generateKeyPair());
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> verifier.verify(forged)).getStatusCode().value());
    }
    @Test void rejectsMalformedTokenAndMissingToken() {
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> verifier.verify("not.a.token")).getStatusCode().value());
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> verifier.verify(null)).getStatusCode().value());
    }
    @Test void missingConfigurationFailsClosed() {
        var disabled = new GoogleIdentityVerifier("");
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> disabled.verify("token")).getStatusCode().value());
    }
}
