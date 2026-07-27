package com.metaplatform.a2a;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * TECH-A2A 服务启动类。
 *
 * <p>对应 Python {@code main.py}，使用 Spring Boot + Nacos Discovery。
 * 启用 {@link EnableDiscoveryClient} 以注册到 Nacos 3.0+ 注册中心。
 * 启用 {@link EnableScheduling} 以支持 Outbox 兜底重发定时任务。</p>
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableScheduling
public class A2aApplication {
    public static void main(String[] args) {
        SpringApplication.run(A2aApplication.class, args);
    }
}
