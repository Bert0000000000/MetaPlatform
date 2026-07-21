package com.metaplatform.ont.config;

import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.config.ConfigService;
import com.alibaba.nacos.api.exception.NacosException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Nacos 3.0+ 配置：拉取模型路由 & 动态配置
 * 用于 v1.2 阶段 2：SAA ChatModel 动态路由
 */
@Slf4j
@Configuration
public class NacosConfig {

    @Value("${spring.cloud.nacos.config.server-addr:localhost:8848}")
    private String nacosServerAddr;

    @Value("${spring.cloud.nacos.config.namespace:metaplatform}")
    private String namespace;

    @Bean
    public ConfigService nacosConfigService() throws NacosException {
        log.info("Initializing Nacos ConfigService at {} namespace={}", nacosServerAddr, namespace);
        return NacosFactory.createConfigService(nacosServerAddr);
    }
}