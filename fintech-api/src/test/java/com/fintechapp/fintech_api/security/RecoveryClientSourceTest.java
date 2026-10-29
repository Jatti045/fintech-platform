package com.fintechapp.fintech_api.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;

class RecoveryClientSourceTest {
    private MockHttpServletRequest request(String peer, String chain) {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        if (chain != null) request.addHeader("X-Forwarded-For", chain);
        return request;
    }
    @Test void ignoresForwardedHeadersByDefault() {
        assertEquals("203.0.113.5", new RecoveryClientSource("").resolve(request("203.0.113.5", "198.51.100.1")));
    }
    @Test void untrustedPeerCannotChooseAnotherSource() {
        assertEquals("203.0.113.5", new RecoveryClientSource("10.0.0.0/8")
                .resolve(request("203.0.113.5", "198.51.100.1")));
    }
    @Test void walksTrustedChainFromThePeerAndStopsAtFirstUntrustedHop() {
        assertEquals("198.51.100.1", new RecoveryClientSource("10.0.0.0/8")
                .resolve(request("10.0.0.1", "192.0.2.99, 198.51.100.1, 10.0.0.2")));
    }
    @Test void malformedAndOversizedChainsFallBackToThePeer() {
        var resolver = new RecoveryClientSource("10.0.0.0/8");
        assertEquals("10.0.0.1", resolver.resolve(request("10.0.0.1", "example.com")));
        assertEquals("10.0.0.1", resolver.resolve(request("10.0.0.1", "198.51.100.1,")));
        assertEquals("10.0.0.1", resolver.resolve(request("10.0.0.1", "1.1.1.1,".repeat(30))));
        assertEquals("10.0.0.1", resolver.resolve(request("10.0.0.1", "x".repeat(2049))));
    }
    @Test void canonicalizesIpv6() {
        var resolver = new RecoveryClientSource("");
        assertEquals(resolver.resolve(request("2001:db8::1", null)),
                resolver.resolve(request("2001:0db8:0:0:0:0:0:1", null)));
    }
}
