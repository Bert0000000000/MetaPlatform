package com.metaplatform.dw.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "mate.dw")
@Data
public class DwProperties {
    private String agentBaseUrl;
    private String ragBaseUrl;
    private String a2aBaseUrl;
    private String llmgwBaseUrl;
    private String ontBaseUrl;
    private RagAgent ragAgent = new RagAgent();
    private PageAgent pageAgent = new PageAgent();

    @Data
    public static class RagAgent {
        private int maxTopk = 100;
        private int timeoutMs = 5000;
        private int maxConcurrentPerEmployee = 50;
        private int maxQpsPerUser = 10;
    }

    @Data
    public static class PageAgent {
        private int p95LatencyMs = 2000;
        private int maxContextTokens = 8192;
    }
}