package com.metaplatform.obs.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean(name = "lokiRestTemplate")
    public RestTemplate lokiRestTemplate(RestTemplateBuilder builder, ObsLokiProperties properties) {
        return builder
                .connectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
                .readTimeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                .build();
    }

    @Bean(name = "prometheusRestTemplate")
    public RestTemplate prometheusRestTemplate(RestTemplateBuilder builder, ObsPrometheusProperties properties) {
        return builder
                .connectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
                .readTimeout(Duration.ofMillis(properties.getReadTimeoutMs()))
                .build();
    }
}
