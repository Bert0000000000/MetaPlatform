package com.metaplatform.mcp.iam.config;

import com.metaplatform.mcp.iam.filter.IamAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * MCP 服务安全配置。
 * 鉴权逻辑由 IamAuthFilter 处理：iam.enabled=false 时 Filter 透传；
 * iam.enabled=true 时校验 API Key / JWT Bearer，否则 401。
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, IamAuthFilter iamAuthFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/v1/mcp/jsonrpc").permitAll()
                        .requestMatchers("/api/v1/mcp/servers/*/rpc").permitAll()
                        .requestMatchers("/api/v1/mcp/servers/*/sse").permitAll()
                        .requestMatchers("/api/v1/mcp/servers/*/stream").permitAll()
                        .anyRequest().permitAll()
                )
                .addFilterBefore(iamAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}