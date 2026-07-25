package com.metaplatform.data;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * TECH-DATA 数据集成服务启动类。
 *
 * <p>提供数据源管理、Schema 发现、SQL 查询、ETL/DBT/Lakehouse/Warehouse 管理、
 * 数据目录、数据质量、监控告警、交付物、全局搜索与数据血缘等能力。</p>
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableAsync
public class DataApplication {
    public static void main(String[] args) {
        SpringApplication.run(DataApplication.class, args);
    }
}
