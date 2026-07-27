package com.metaplatform.wfe.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * 集成服务 WebClient 配置：TECH-IAM / TECH-RULE / TECH-ONT。
 */
@Configuration
public class IntegrationConfig {

    @Bean
    public WebClient iamWebClient(@Value("${iam.base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }

    @Bean
    public WebClient ruleWebClient(@Value("${rule.base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }

    @Bean
    public WebClient ontWebClient(@Value("${ont.base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }
}
