package com.metaplatform.a2a.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.util.concurrent.TimeUnit;

/**
 * WebClient 配置。
 *
 * <p>预配置三个 Bean，分别用于调用外部 A2A Agent / TECH-AGENT / TECH-WFE 服务，
 * 共享连接池与超时设置。Service 层注入对应名称的 WebClient 即可。</p>
 *
 * <p>Bean 命名约定：{@code agentWebClient} / {@code agentServiceWebClient} / {@code wfeWebClient}。</p>
 */
@Configuration
public class WebClientConfig {

    @Bean(name = "agentWebClient")
    public WebClient agentWebClient(A2aProperties properties) {
        return buildWebClient(properties.getAgentBaseUrl(), properties.getAgentTimeout());
    }

    @Bean(name = "agentServiceWebClient")
    public WebClient agentServiceWebClient(A2aProperties properties) {
        return buildWebClient(properties.getAgentServiceBaseUrl(), properties.getAgentServiceTimeout());
    }

    @Bean(name = "wfeWebClient")
    public WebClient wfeWebClient(A2aProperties properties) {
        return buildWebClient(properties.getWfeBaseUrl(), properties.getWfeTimeout());
    }

    private WebClient buildWebClient(String baseUrl, java.time.Duration timeout) {
        long timeoutMs = timeout.toMillis();
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) Math.min(timeoutMs, Integer.MAX_VALUE))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS)));

        return WebClient.builder()
                .baseUrl(baseUrl != null ? baseUrl : "")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }
}
