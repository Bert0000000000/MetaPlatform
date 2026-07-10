package com.metaplatform.appservice;

import com.metaplatform.appservice.config.AppServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * metaplatform-app-service 主入口。
 *
 * <p>Sprint 0 阶段：完成"应用中心"领域服务的脚手架 + 8 张元数据表迁移。
 * <p>v1.0.1 范围：apps / app_objects / app_forms 的 CRUD + audit + 跨租户隔离；
 * Sprint 1 接入 ontology-engine；Sprint 2 接入表单数据 submit / list。
 */
@SpringBootApplication(scanBasePackages = "com.metaplatform.appservice")
@EntityScan("com.metaplatform.appservice.domain")
@EnableJpaRepositories("com.metaplatform.appservice.domain")
@EnableConfigurationProperties(AppServiceProperties.class)
public class AppServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AppServiceApplication.class, args);
    }
}
