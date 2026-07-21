package com.metaplatform.ont.service;

import com.alibaba.nacos.api.config.ConfigService;
import com.metaplatform.ont.dto.DataSourceDto;
import com.metaplatform.ont.dto.DiscoveryResponse;
import com.metaplatform.ont.dto.ImportRequest;
import com.metaplatform.ont.dto.SuggestRequest;
import com.metaplatform.ont.entity.OntologyDiscoveryEntity;
import com.metaplatform.ont.repository.OntologyDiscoveryRepository;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * OntologyDiscoveryService 集成测试。
 * <p>
 * 主路径：使用 Testcontainers 启动真实 PostgreSQL（推荐，CI/本地有 Docker 时）。
 * 兜底路径：当当前 JVM 无法访问 Docker 守护进程时，回退到已存在的本地 PostgreSQL
 * （例如本机 infra-postgres 容器在 localhost:5432 运行），以便在无 Docker-in-Docker
 * 的 Agent 环境仍能验证 suggest 业务逻辑。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@TestPropertySource(properties = {
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.neo4j.Neo4jAutoConfiguration," +
                "org.springframework.ai.autoconfigure.chat.client.ChatClientAutoConfiguration," +
                "org.springframework.ai.mcp.server.common.autoconfigure.McpServerAutoConfiguration",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class OntologyDiscoveryServiceTest {

    private static final Logger log = LoggerFactory.getLogger(OntologyDiscoveryServiceTest.class);

    private static final String FALLBACK_DB = "metaplatform_ont";
    private static final String FALLBACK_USER = "meta";
    private static final String FALLBACK_PASSWORD = "meta";

    private static final boolean DOCKER_AVAILABLE;
    private static PostgreSQLContainer<?> postgres;

    static {
        boolean available;
        try {
            DockerClientFactory.instance().client();
            available = true;
        } catch (IllegalStateException e) {
            log.warn("Docker environment not accessible from test JVM, falling back to existing PostgreSQL at localhost:5432");
            available = false;
        }
        DOCKER_AVAILABLE = available;
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        if (DOCKER_AVAILABLE) {
            postgres = new PostgreSQLContainer<>("postgres:17-alpine")
                    .withDatabaseName(FALLBACK_DB)
                    .withUsername(FALLBACK_USER)
                    .withPassword(FALLBACK_PASSWORD);
            postgres.start();
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
            registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
        } else {
            registry.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:5432/" + FALLBACK_DB);
            registry.add("spring.datasource.username", () -> FALLBACK_USER);
            registry.add("spring.datasource.password", () -> FALLBACK_PASSWORD);
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        }
    }

    @Autowired
    private OntologyDiscoveryService service;

    @Autowired
    private OntologyDiscoveryRepository repository;

    @Autowired
    private ChatClient.Builder chatClientBuilder;

    @Test
    void getDataSources_returnsMockCatalog() {
        List<DataSourceDto> result = service.getDataSources();

        assertThat(result).hasSize(4);
        assertThat(result).extracting(DataSourceDto::getType)
                .containsExactly("POSTGRESQL", "MYSQL", "KAFKA", "MONGODB");
        assertThat(result).extracting(DataSourceDto::getId)
                .containsExactly("pg-prod", "mysql-crm", "kafka-events", "mongo-logs");
    }

    @Test
    void analyze_savesTaskAndReturnsResponse() {
        DiscoveryResponse result = service.analyze("tenant1", "pg-prod", List.of("users", "orders"));

        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getTaskId()).isNotBlank();
        assertThat(result.getMessage()).contains("2 tables").contains("pg-prod");

        List<OntologyDiscoveryEntity> saved = repository.findByTenantIdAndSourceId("tenant1", "pg-prod");
        assertThat(saved).isNotEmpty();
        OntologyDiscoveryEntity entity = saved.get(0);
        assertThat(entity.getSourceType()).isEqualTo("POSTGRESQL");
        assertThat(entity.getStatus()).isEqualTo("COMPLETED");
        assertThat(entity.getResultJson()).contains("users", "orders");
    }

    @Test
    void importCandidates_savesImportTask() {
        ImportRequest req = new ImportRequest();
        req.setSourceId("pg-prod");
        req.setConceptIds(List.of("c1", "c2", "c3"));

        DiscoveryResponse result = service.importCandidates("tenant1", req);

        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getMessage()).contains("Imported 3 concepts");

        List<OntologyDiscoveryEntity> saved = repository.findByTenantIdAndSourceId("tenant1", "pg-prod");
        assertThat(saved).anyMatch(e -> "IMPORT".equals(e.getSourceType()) && e.getResultJson().contains("\"imported\":3"));
    }

    @Test
    void suggest_returnsGeneratedResponse() {
        // Given: mock 整个 SAA ChatClient 调用链
        ChatClient chatClient = mock(ChatClient.class);
        ChatClient.ChatClientRequestSpec requestSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec responseSpec = mock(ChatClient.CallResponseSpec.class);

        when(chatClientBuilder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(requestSpec);
        when(requestSpec.system(anyString())).thenReturn(requestSpec);
        when(requestSpec.user(anyString())).thenReturn(requestSpec);
        when(requestSpec.call()).thenReturn(responseSpec);
        when(responseSpec.content()).thenReturn("""
                [
                  {"concept":"Customer","suggestion":"Rename to Client","reason":"clearer semantics"},
                  {"concept":"has","suggestion":"Use owns","reason":"stronger relationship"}
                ]
                """);

        SuggestRequest req = new SuggestRequest();
        req.setConcepts(List.of("Customer"));
        req.setRelations(List.of("has"));

        // When
        DiscoveryResponse result = service.suggest("tenant1", "pg-prod", req);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getMessage()).contains("Suggestions generated");
        assertThat(result.getSuggestions()).isNotEmpty();
        assertThat(result.getSuggestions().get(0))
                .contains("Customer")
                .contains("Rename to Client")
                .contains("has")
                .contains("owns");
    }

    /**
     * 测试专用配置：提供 singleton 作用域的 ChatClient.Builder 与 ConfigService mock，
     * 避免 Spring AI ChatClientAutoConfiguration 原型作用域 bean 无法被 @MockitoBean 覆盖的问题，
     * 同时绕过 NacosConfig 对真实 Nacos 服务的连接。
     */
    @TestConfiguration
    static class TestConfig {

        @Bean
        @Primary
        public ChatClient.Builder chatClientBuilder() {
            return mock(ChatClient.Builder.class);
        }

        @Bean
        @Primary
        public ConfigService configService() {
            return mock(ConfigService.class);
        }
    }
}
