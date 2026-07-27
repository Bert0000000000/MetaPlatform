package com.metaplatform.data.config;

import io.minio.MinioClient;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MinIO 对象存储配置（DeliverableService presigned URL 使用）。
 *
 * <p>对应 application.yml 中 {@code mate.minio.*} 配置。</p>
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mate.minio")
public class MinioConfig {

    private String endpoint = "http://localhost:9000";
    private String accessKey = "minioadmin";
    private String secretKey = "minioadmin";
    private String bucket = "metaplatform-deliverables";

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
}
