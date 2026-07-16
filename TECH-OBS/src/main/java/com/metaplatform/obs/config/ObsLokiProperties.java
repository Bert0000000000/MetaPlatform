package com.metaplatform.obs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.obs.loki")
public class ObsLokiProperties {

    private String baseUrl = "http://localhost:3100";
    private String queryPath = "/loki/api/v1/query_range";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 30000;
    private int defaultLimit = 100;
    private int maxLimit = 5000;
}
