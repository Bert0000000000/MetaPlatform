package com.metaplatform.obs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.obs.prometheus")
public class ObsPrometheusProperties {

    private String baseUrl = "http://localhost:9090";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 30000;
}
