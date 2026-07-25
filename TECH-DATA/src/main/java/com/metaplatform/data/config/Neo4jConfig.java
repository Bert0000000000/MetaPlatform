package com.metaplatform.data.config;

import lombok.Getter;
import lombok.Setter;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.SessionConfig;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Neo4j 图数据库配置（数据血缘 LineageService 使用）。
 *
 * <p>使用 neo4j-java-driver 直接调用 Cypher，不引入 spring-data-neo4j（避免依赖膨胀）。</p>
 *
 * <p>对应 application.yml 中 {@code mate.neo4j.*} 配置。</p>
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mate.neo4j")
public class Neo4jConfig {

    private String uri = "bolt://localhost:7687";
    private String username = "neo4j";
    private String password = "neo4j";
    private int maxConnectionPoolSize = 10;

    @Bean(destroyMethod = "close")
    public Driver neo4jDriver() {
        return GraphDatabase.driver(uri, AuthTokens.basic(username, password));
    }

    @Bean
    public SessionConfig neo4jSessionConfig() {
        return SessionConfig.forDatabase("neo4j");
    }
}
