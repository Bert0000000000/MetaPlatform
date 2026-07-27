package com.metaplatform.mcp;

import com.metaplatform.mcp.iam.filter.IamAuthFilter;
import com.metaplatform.mcp.jsonrpc.McpProtocolService;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.io.IOException;

import static org.mockito.Mockito.mock;

/**
 * Shared test configuration for @WebMvcTest controller tests.
 * Provides a pass-through IamAuthFilter and mock non-web beans
 * (McpProtocolService, McpServerRepository) so controllers load
 * without JPA / service-layer dependencies.
 */
@TestConfiguration
public class IamTestConfig {

    @Bean
    @Primary
    public IamAuthFilter iamAuthFilter() {
        return new IamAuthFilter(null, null, null) {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                            FilterChain filterChain) throws ServletException, IOException {
                filterChain.doFilter(request, response);
            }
        };
    }

    @Bean
    @Primary
    public McpProtocolService mcpProtocolService() {
        return mock(McpProtocolService.class);
    }

    @Bean
    @Primary
    public McpServerRepository mcpServerRepository() {
        return mock(McpServerRepository.class);
    }
}
