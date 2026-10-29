package com.fintechapp.fintech_api.security;

import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

/** Only configured proxy peers may supply a forwarding chain. Never trust a body or header alone. */
@Component
public class RecoveryClientSource {
    private final List<IpAddressMatcher> trustedProxies;
    public RecoveryClientSource(@Value("${app.security.recovery.trusted-proxies:}") String proxies) {
        trustedProxies = Arrays.stream(proxies.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .map(IpAddressMatcher::new).toList();
    }

    public String resolve(HttpServletRequest request) {
        String peer = canonical(request.getRemoteAddr());
        if (peer == null) return "unknown-peer";
        String forwarded = request.getHeader("X-Forwarded-For");
        if (!trusted(peer) || forwarded == null || forwarded.length() > 2048) return peer;
        String[] chain = forwarded.split(",", -1);
        if (chain.length > 20) return peer;
        String current = peer;
        for (int i = chain.length - 1; i >= 0 && trusted(current); i--) {
            String address = canonical(chain[i].trim());
            if (address == null) return peer;
            current = address;
        }
        return current;
    }

    private boolean trusted(String address) { return trustedProxies.stream().anyMatch(proxy -> proxy.matches(address)); }
    private static String canonical(String value) {
        if (value == null || value.isBlank()) return null;
        // Require an IP literal, so forwarding values cannot trigger DNS lookups.
        if (!value.matches("[0-9a-fA-F:.]+") || (!value.contains(":") && !value.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+"))) return null;
        try { return InetAddress.getByName(value).getHostAddress(); }
        catch (java.net.UnknownHostException invalid) { return null; }
    }
}
