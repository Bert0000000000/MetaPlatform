package com.metaplatform.wfe.security;

import lombok.Getter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.stream.Collectors;

@Getter
public class JwtAuthenticationToken extends UsernamePasswordAuthenticationToken {

    private final String userId;
    private final String tenantId;
    private final List<String> roles;

    public JwtAuthenticationToken(String userId, String username, String tenantId, List<String> roles) {
        super(username, null, roles == null ? List.of() : roles.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList()));
        this.userId = userId;
        this.tenantId = tenantId;
        this.roles = roles == null ? List.of() : List.copyOf(roles);
    }
}
