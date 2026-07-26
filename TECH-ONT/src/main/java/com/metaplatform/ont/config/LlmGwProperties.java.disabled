package com.metaplatform.ont.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * TECH-LLMGW 服务连接配置
 */
@Data
@Component
@ConfigurationProperties(prefix = "mate.llmgw")
public class LlmGwProperties {
    /** LLMGW 服务地址 */
    private String baseUrl = "http://localhost:8210";
    /** 默认模型名 */
    private String defaultModel = "qwen-max";
    /** 请求超时（秒） */
    private int timeoutSeconds = 30;
}
