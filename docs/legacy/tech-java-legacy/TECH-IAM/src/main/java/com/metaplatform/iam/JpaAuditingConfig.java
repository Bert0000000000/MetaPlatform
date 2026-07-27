package com.metaplatform.iam;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * JPA Auditing 配置：独立配置类，避免放在 {@link IamApplication} 上导致
 * {@code @WebMvcTest} 切片测试触发 "JPA metamodel must not be empty" 错误。
 * 这是 Spring Boot 官方推荐做法：https://docs.spring.io/spring-boot/docs/current/reference/html/data.html#data.jpa.auditing
 */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
