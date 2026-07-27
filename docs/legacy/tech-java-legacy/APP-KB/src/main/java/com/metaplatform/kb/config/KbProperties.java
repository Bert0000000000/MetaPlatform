package com.metaplatform.kb.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "mate.kb")
@Data
public class KbProperties {
    private String ragBaseUrl;
    private String ontBaseUrl;
    private String dataBaseUrl;
    private String iamBaseUrl;
    private String msgBaseUrl;
    private String obsBaseUrl;
}
