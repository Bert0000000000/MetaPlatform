package com.metaplatform.appservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * app-service 顶层配置（来自 application.yml 的 metaplatform.* 节）。
 */
@ConfigurationProperties(prefix = "metaplatform")
public record AppServiceProperties(
        String defaultTenant,
        Auth auth,
        OntologyEngine ontologyEngine,
        PageGenerator pageGenerator,
        String traceIdHeader
) {
    public record Auth(String mode) {
        public boolean isDev() {
            return "dev".equalsIgnoreCase(mode);
        }
    }

    public record OntologyEngine(String url) {}

    public record PageGenerator(String url) {}
}
