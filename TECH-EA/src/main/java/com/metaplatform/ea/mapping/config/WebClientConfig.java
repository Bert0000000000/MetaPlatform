package com.metaplatform.ea.mapping.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient ontWebClient(@Value("${ea.ont.base-url:http://localhost:8201}") String baseUrl) {
        HttpClient httpClient = HttpClient.builder()
                .responseTimeout(Duration.ofSeconds(10))
                .build();
        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
