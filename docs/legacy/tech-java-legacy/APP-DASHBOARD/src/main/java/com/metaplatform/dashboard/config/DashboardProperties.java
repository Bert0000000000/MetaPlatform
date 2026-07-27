package com.metaplatform.dashboard.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "mate.dashboard")
@Data
public class DashboardProperties {
    private String iamBaseUrl;
    private String obsBaseUrl;
    private String wfeBaseUrl;
    private String msgBaseUrl;
    private String ontBaseUrl;
    private String llmgwBaseUrl;
    private String ragBaseUrl;
}
