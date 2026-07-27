package com.metaplatform.agent.deerflow;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "deerflow")
public class DeerFlowProperties {
    private String gatewayUrl = "http://localhost:2026/api";
    private String internalToken;
    private String ownerUserId = "deerflow-internal-owner";
    private Duration requestTimeout = Duration.ofSeconds(30);
    private Duration streamTimeout = Duration.ofSeconds(60);
    private Duration reconnectTimeout = Duration.ofSeconds(60);
    private boolean enabled = true;
}
