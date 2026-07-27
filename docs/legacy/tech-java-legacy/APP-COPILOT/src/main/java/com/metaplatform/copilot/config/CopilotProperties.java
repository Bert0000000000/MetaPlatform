package com.metaplatform.copilot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "mate.copilot")
@Data
public class CopilotProperties {
    private String llmgwBaseUrl;
    private String a2aBaseUrl;
    private String agentBaseUrl;
    private String ragBaseUrl;
    private String mcpBaseUrl;
    private String actionBaseUrl;
    private String ontBaseUrl;
    private String dataBaseUrl;
    private Scheduling scheduling = new Scheduling();

    @Data
    public static class Scheduling {
        private int singleAgentTimeoutMs = 5000;
        private int overallTimeoutMs = 10000;
        private int maxParallelAgents = 5;
        private boolean fallbackToRag = true;
    }
}