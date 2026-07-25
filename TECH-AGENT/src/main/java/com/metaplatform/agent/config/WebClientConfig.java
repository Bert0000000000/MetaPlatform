package com.metaplatform.agent.config;

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
 * <p>预配置三个 Bean，分别用于调用上游 LLMGW / Action / RAG 服务，
 * 共享连接池与超时设置。Service 层注入对应名称的 WebClient 即可。</p>
 *
 * <p>Bean 命名约定：{@code llmgwWebClient} / {@code actionWebClient} / {@code ragWebClient}。</p>
 */
@Configuration
public class WebClientConfig {

    /**
     * LLM Gateway WebClient。
     */
    @Bean(name = "llmgwWebClient")
    public WebClient llmgwWebClient(AgentProperties properties) {
        return buildWebClient(properties.getLlmgwBaseUrl(), properties.getLlmgwTimeout());
    }

    /**
     * Action 服务 WebClient。
     */
    @Bean(name = "actionWebClient")
    public WebClient actionWebClient(AgentProperties properties) {
        return buildWebClient(properties.getActionBaseUrl(), properties.getActionTimeout());
    }

    /**
     * RAG 服务 WebClient。
     */
    @Bean(name = "ragWebClient")
    public WebClient ragWebClient(AgentProperties properties) {
        return buildWebClient(properties.getRagBaseUrl(), properties.getRagTimeout());
    }

    /**
     * 构建通用 WebClient：JSON 默认头 + 连接/读写超时。
     */
    private WebClient buildWebClient(String baseUrl, java.time.Duration timeout) {
        long timeoutMs = timeout.toMillis();
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) Math.min(timeoutMs, Integer.MAX_VALUE))
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(timeout.toSeconds(), TimeUnit.SECONDS)));

        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }
}
