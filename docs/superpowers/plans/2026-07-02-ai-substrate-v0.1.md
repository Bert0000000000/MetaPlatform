# AI Substrate v0.1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 MetaPlatform 的 AI Substrate v0.1 —— LLM Gateway（OpenAI + Anthropic 双适配器）、Embedding Service、Context Store、In-Memory Vector Store、Agent Runtime、Token Billing，为上层 AI 应用提供统一的 AI 基础设施。

**Architecture:** 独立 Java 21 + Spring Boot 3.2 项目 · PostgreSQL 16（配置/账单持久化）· Redis 7（Context Store + 嵌入缓存 + 计数器）· 多租户 · DDD 分层。

**Tech Stack:**
- 后端：Java 21+、Spring Boot 3.2+、Maven
- 数据库：PostgreSQL 16+（token 账单持久化、配置存储）
- 缓存：Redis 7+（Context Store 滑动窗口 + Embedding 缓存 + Token 计数器）
- LLM API：OpenAI GPT-4/3.5、Anthropic Claude（HTTP 客户端调用）
- Embedding：OpenAI text-embedding-ada-002
- 向量存储：In-Memory（v0.1 替代 Milvus，余弦相似度搜索）
- 测试：JUnit 5、Testcontainers、MockWebServer（Mock HTTP）
- 容器化：Docker + docker-compose

**对应 spec：** §5.2.4 L2-4 AI 基板层
**对应决策：** D10（LLM Gateway = 统一抽象）、D5（Embedding = 平台能力）、D14（v0.1 用内存向量存储替代 Milvus）
**对应阶段：** 第 1 期 · Spike（T-1 ~ T0）

---

## 文件结构

```
metaplatform-ai-substrate/
├── pom.xml                                    # 父 POM
├── docker-compose.yml                         # 一键起 PG/Redis
├── README.md                                  # 启动文档
├── src/
│   ├── main/
│   │   ├── java/com/metaplatform/ai/
│   │   │   ├── AiSubstrateApplication.java            # Spring Boot 入口
│   │   │   ├── config/
│   │   │   │   ├── RedisConfig.java                   # Redis 连接配置
│   │   │   │   └── RestTemplateConfig.java            # HTTP 客户端配置
│   │   │   ├── llm/
│   │   │   │   ├── LlmGateway.java                    # 网关接口
│   │   │   │   ├── LlmAdapter.java                    # 适配器接口
│   │   │   │   ├── LlmRequest.java                    # 请求 DTO
│   │   │   │   ├── LlmResponse.java                   # 响应 DTO
│   │   │   │   ├── ModelAlias.java                    # 模型别名路由
│   │   │   │   ├── adapter/
│   │   │   │   │   ├── OpenAiAdapter.java             # OpenAI 适配器
│   │   │   │   │   └── AnthropicAdapter.java          # Anthropic 适配器
│   │   │   │   └── LlmGatewayImpl.java                # 网关实现（路由 + 降级）
│   │   │   ├── embedding/
│   │   │   │   ├── EmbeddingService.java              # 嵌入服务接口
│   │   │   │   ├── EmbeddingRequest.java              # 请求 DTO
│   │   │   │   ├── EmbeddingResponse.java             # 响应 DTO
│   │   │   │   └── OpenAiEmbeddingService.java        # OpenAI ada-002 实现
│   │   │   ├── context/
│   │   │   │   ├── ContextStore.java                  # 上下文存储接口
│   │   │   │   └── RedisContextStore.java             # Redis 滑动窗口实现
│   │   │   ├── vector/
│   │   │   │   ├── VectorStore.java                   # 向量存储接口
│   │   │   │   ├── SearchResult.java                  # 搜索结果
│   │   │   │   └── InMemoryVectorStore.java           # 内存向量存储（v0.1）
│   │   │   ├── agent/
│   │   │   │   ├── AgentRuntime.java                  # Agent 运行时
│   │   │   │   ├── AgentRequest.java                  # 请求 DTO
│   │   │   │   ├── AgentResponse.java                 # 响应 DTO
│   │   │   │   ├── ToolDefinition.java                # 工具定义
│   │   │   │   └── ToolExecutor.java                  # 工具执行器接口
│   │   │   ├── billing/
│   │   │   │   ├── TokenBillingService.java           # Token 计费服务
│   │   │   │   ├── TokenUsage.java                    # 使用量记录
│   │   │   │   └── BillingRepository.java             # 账单持久化
│   │   │   └── interfaces/
│   │   │       └── rest/
│   │   │           ├── LlmController.java             # /api/v1/llm/chat
│   │   │           ├── EmbeddingController.java       # /api/v1/embeddings
│   │   │           ├── ContextController.java         # /api/v1/context
│   │   │           ├── AgentController.java           # /api/v1/agent
│   │   │           ├── BillingController.java         # /api/v1/billing
│   │   │           └── dto/
│   │   │               ├── ChatRequest.java
│   │   │               ├── ChatResponse.java
│   │   │               ├── EmbeddingApiRequest.java
│   │   │               ├── EmbeddingApiResponse.java
│   │   │               ├── ContextApiRequest.java
│   │   │               ├── AgentApiRequest.java
│   │   │               └── BillingSummary.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   │           └── V1__init_ai_substrate.sql
│   └── test/
│       └── java/com/metaplatform/ai/
│           ├── llm/
│           │   ├── LlmGatewayImplTest.java
│           │   ├── OpenAiAdapterTest.java
│           │   └── AnthropicAdapterTest.java
│           ├── embedding/
│           │   └── OpenAiEmbeddingServiceTest.java
│           ├── context/
│           │   └── RedisContextStoreTest.java
│           ├── vector/
│           │   └── InMemoryVectorStoreTest.java
│           ├── agent/
│           │   └── AgentRuntimeTest.java
│           ├── billing/
│           │   └── TokenBillingServiceTest.java
│           └── interfaces/
│               └── LlmControllerTest.java
└── docs/
    └── api/
        └── openapi.yaml                       # REST API 契约
```

---

## Task 1: 仓库初始化

**Files:**
- Create: `metaplatform-ai-substrate/pom.xml`
- Create: `metaplatform-ai-substrate/docker-compose.yml`
- Create: `metaplatform-ai-substrate/README.md`
- Create: `metaplatform-ai-substrate/.gitignore`

- [ ] **Step 1.1: 初始化 Git 仓库**

```bash
cd metaplatform-ai-substrate
git init
git checkout -b main
```

- [ ] **Step 1.2: 写父 POM**

`pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.metaplatform</groupId>
    <artifactId>metaplatform-ai-substrate</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <properties>
        <java.version>21</java.version>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <testcontainers.version>1.19.7</testcontainers.version>
    </properties>

    <dependencies>
        <!-- Spring Boot starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
        </dependency>

        <!-- Database -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <!-- Jackson -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
        </dependency>

        <!-- OkHttp (for OpenAI/Anthropic HTTP calls) -->
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>okhttp</artifactId>
            <version>4.12.0</version>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${testcontainers.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>mockwebserver</artifactId>
            <version>4.12.0</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 1.3: 写 docker-compose**

`docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: mp-ai-postgres
    ports:
      - "5435:5432"
    environment:
      POSTGRES_DB: ai_substrate
      POSTGRES_USER: ai
      POSTGRES_PASSWORD: metaplatform
    volumes:
      - pg-ai-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: mp-ai-redis
    ports:
      - "6381:6379"
    volumes:
      - redis-ai-data:/data

volumes:
  pg-ai-data:
  redis-ai-data:
```

- [ ] **Step 1.4: 写 application.yml**

`src/main/resources/application.yml`：

```yaml
server:
  port: 8083

spring:
  application:
    name: ai-substrate
  datasource:
    url: jdbc:postgresql://localhost:5435/ai_substrate
    username: ai
    password: metaplatform
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: localhost
      port: 6381

# AI Provider 配置
ai:
  openai:
    api-key: ${OPENAI_API_KEY:sk-placeholder}
    base-url: https://api.openai.com/v1
    default-model: gpt-4o
    embedding-model: text-embedding-ada-002
  anthropic:
    api-key: ${ANTHROPIC_API_KEY:sk-ant-placeholder}
    base-url: https://api.anthropic.com/v1
    default-model: claude-3-sonnet-20240229
  # 模型别名路由
  model-aliases:
    fast: gpt-3.5-turbo
    smart: gpt-4o
    claude: claude-3-sonnet-20240229
    claude-fast: claude-3-haiku-20240307
  # Token 配置
  billing:
    daily-quota-per-tenant: 1000000

logging:
  level:
    com.metaplatform.ai: DEBUG
```

- [ ] **Step 1.5: 写 README 和 .gitignore**

`README.md`：

```markdown
# MetaPlatform AI Substrate v0.1

Spike 期交付物。详细 plan 见 `docs/superpowers/plans/2026-07-02-ai-substrate-v0.1.md`。

## 启动

```bash
docker-compose up -d
./mvnw spring-boot:run
```

## 环境变量

- `OPENAI_API_KEY`: OpenAI API 密钥
- `ANTHROPIC_API_KEY`: Anthropic API 密钥

## 端口

- PostgreSQL: localhost:5435
- Redis: localhost:6381
- 本服务: localhost:8083
```

`.gitignore`：

```
target/
.idea/
*.iml
.vscode/
.DS_Store
*.log
.env
```

- [ ] **Step 1.6: 启动基础设施并验证**

```bash
docker-compose up -d
docker ps
```

Expected: 2 个容器运行（postgres/redis）

- [ ] **Step 1.7: 提交**

```bash
git add .
git commit -m "chore: initialize AI substrate module with maven, docker-compose"
```

---

## Task 2: LLM Gateway — 接口 + DTO + ModelAlias

**Files:**
- Create: `src/main/java/com/metaplatform/ai/llm/LlmRequest.java`
- Create: `src/main/java/com/metaplatform/ai/llm/LlmResponse.java`
- Create: `src/main/java/com/metaplatform/ai/llm/LlmAdapter.java`
- Create: `src/main/java/com/metaplatform/ai/llm/LlmGateway.java`
- Create: `src/main/java/com/metaplatform/ai/llm/ModelAlias.java`

- [ ] **Step 2.1: 写 LlmRequest DTO**

```java
package com.metaplatform.ai.llm;

import java.util.List;
import java.util.Map;

/**
 * LLM 请求：统一的请求格式，适配器负责转换为各厂商格式。
 */
public record LlmRequest(
    String model,                       // 模型名或别名（如 "fast", "smart", "gpt-4o"）
    List<ChatMessage> messages,         // 消息列表
    double temperature,                 // 温度 0.0-2.0
    int maxTokens,                      // 最大输出 token
    Map<String, Object> extra           // 厂商特定参数
) {
    public LlmRequest {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("model must not be blank");
        }
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("messages must not be empty");
        }
        if (temperature < 0 || temperature > 2) {
            throw new IllegalArgumentException("temperature must be between 0 and 2");
        }
    }

    public record ChatMessage(
        String role,    // system, user, assistant, tool
        String content
    ) {
        public ChatMessage {
            if (role == null || role.isBlank()) {
                throw new IllegalArgumentException("role must not be blank");
            }
            if (content == null) {
                content = "";
            }
        }
    }

    public static LlmRequest simple(String model, String userMessage) {
        return new LlmRequest(
                model,
                List.of(new ChatMessage("user", userMessage)),
                0.7,
                1024,
                Map.of()
        );
    }
}
```

- [ ] **Step 2.2: 写 LlmResponse DTO**

```java
package com.metaplatform.ai.llm;

import java.util.Map;

/**
 * LLM 响应：统一的响应格式。
 */
public record LlmResponse(
    String id,                          // 响应 ID
    String model,                       // 实际使用的模型
    String content,                     // 生成的文本内容
    String finishReason,                // stop, length, tool_calls
    TokenUsage usage,                   // Token 用量
    Map<String, Object> metadata        // 厂商特定元数据
) {
    public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens
    ) {}

    public static LlmResponse empty() {
        return new LlmResponse("", "", "", "error", new TokenUsage(0, 0, 0), Map.of());
    }
}
```

- [ ] **Step 2.3: 写 LlmAdapter 接口**

```java
package com.metaplatform.ai.llm;

/**
 * LLM 适配器接口：每个 LLM 厂商实现一个适配器。
 */
public interface LlmAdapter {

    /** 适配器名称 */
    String name();

    /** 是否支持该模型 */
    boolean supportsModel(String model);

    /** 调用 LLM */
    LlmResponse chat(LlmRequest request);
}
```

- [ ] **Step 2.4: 写 ModelAlias**

```java
package com.metaplatform.ai.llm;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 模型别名路由：将别名（如 "fast", "smart"）映射到实际模型名。
 */
@Component
public class ModelAlias {

    private final Map<String, String> aliases;

    public ModelAlias(@Value("#{${ai.model-aliases:{}}}") Map<String, String> aliases) {
        this.aliases = aliases != null ? aliases : Map.of();
    }

    /**
     * 解析模型名：如果是别名则返回实际模型名，否则原样返回。
     */
    public String resolve(String modelOrAlias) {
        return aliases.getOrDefault(modelOrAlias, modelOrAlias);
    }
}
```

- [ ] **Step 2.5: 写 LlmGateway 接口**

```java
package com.metaplatform.ai.llm;

/**
 * LLM Gateway 接口：统一入口，负责模型路由、降级、重试。
 */
public interface LlmGateway {

    /**
     * 发送聊天请求。
     * 自动根据 model 字段路由到对应的 adapter。
     * 如果主适配器失败，自动降级到备选适配器。
     */
    LlmResponse chat(LlmRequest request);

    /**
     * 发送聊天请求，指定租户（用于 token 计费）。
     */
    LlmResponse chat(LlmRequest request, String tenantId);
}
```

- [ ] **Step 2.6: 提交**

```bash
git add src/main/java/com/metaplatform/ai/llm/LlmRequest.java \
        src/main/java/com/metaplatform/ai/llm/LlmResponse.java \
        src/main/java/com/metaplatform/ai/llm/LlmAdapter.java \
        src/main/java/com/metaplatform/ai/llm/LlmGateway.java \
        src/main/java/com/metaplatform/ai/llm/ModelAlias.java
git commit -m "feat(llm): add LLM Gateway interface, DTOs, and ModelAlias router"
```

---

## Task 3: LLM Gateway — OpenAI 适配器

**Files:**
- Create: `src/main/java/com/metaplatform/ai/llm/adapter/OpenAiAdapter.java`
- Test: `src/test/java/com/metaplatform/ai/llm/OpenAiAdapterTest.java`

- [ ] **Step 3.1: 写 OpenAiAdapter**

```java
package com.metaplatform.ai.llm.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ai.llm.LlmAdapter;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
public class OpenAiAdapter implements LlmAdapter {

    private static final Logger log = LoggerFactory.getLogger(OpenAiAdapter.class);

    private final String apiKey;
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;

    public OpenAiAdapter(
            @Value("${ai.openai.api-key}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            ObjectMapper mapper) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.mapper = mapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public boolean supportsModel(String model) {
        return model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-");
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        String resolvedModel = request.model();

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", resolvedModel);
            body.put("temperature", request.temperature());
            body.put("max_tokens", request.maxTokens());

            ArrayNode messagesNode = body.putArray("messages");
            for (LlmRequest.ChatMessage msg : request.messages()) {
                ObjectNode msgNode = messagesNode.addObject();
                msgNode.put("role", msg.role());
                msgNode.put("content", msg.content());
            }

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("OpenAI API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("OpenAI API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode choice = root.path("choices").path(0);
                JsonNode usage = root.path("usage");

                return new LlmResponse(
                        root.path("id").asText(),
                        root.path("model").asText(),
                        choice.path("message").path("content").asText(),
                        choice.path("finish_reason").asText("stop"),
                        new LlmResponse.TokenUsage(
                                usage.path("prompt_tokens").asInt(0),
                                usage.path("completion_tokens").asInt(0),
                                usage.path("total_tokens").asInt(0)
                        ),
                        java.util.Map.of()
                );
            }
        } catch (IOException e) {
            log.error("Failed to call OpenAI API: {}", e.getMessage(), e);
            throw new RuntimeException("OpenAI API call failed", e);
        }
    }
}
```

- [ ] **Step 3.2: 写 OpenAiAdapter 测试**

`OpenAiAdapterTest.java`：

```java
package com.metaplatform.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.adapter.OpenAiAdapter;
import mockwebserver3.MockResponse;
import mockwebserver3.MockWebServer;
import mockwebserver3.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiAdapterTest {

    private MockWebServer mockServer;
    private OpenAiAdapter adapter;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        String baseUrl = mockServer.url("/v1").toString();
        adapter = new OpenAiAdapter("test-key", baseUrl, mapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldSupportGptModels() {
        assertTrue(adapter.supportsModel("gpt-4o"));
        assertTrue(adapter.supportsModel("gpt-3.5-turbo"));
        assertTrue(adapter.supportsModel("o1-preview"));
        assertFalse(adapter.supportsModel("claude-3-opus"));
    }

    @Test
    void shouldCallOpenAiApi() throws Exception {
        String responseJson = """
            {
                "id": "chatcmpl-123",
                "model": "gpt-4o",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15
                }
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = LlmRequest.simple("gpt-4o", "Hello");
        LlmResponse response = adapter.chat(request);

        assertEquals("chatcmpl-123", response.id());
        assertEquals("gpt-4o", response.model());
        assertEquals("Hello!", response.content());
        assertEquals("stop", response.finishReason());
        assertEquals(15, response.usage().totalTokens());

        // 验证请求
        RecordedRequest recorded = mockServer.takeRequest();
        assertEquals("POST", recorded.getMethod());
        assertTrue(recorded.getPath().contains("/chat/completions"));
        String authHeader = recorded.getHeader("Authorization");
        assertEquals("Bearer test-key", authHeader);
    }

    @Test
    void shouldThrowOnApiError() {
        mockServer.enqueue(new MockResponse()
                .setResponseCode(429)
                .setBody("{\"error\": \"rate limit\"}"));

        LlmRequest request = LlmRequest.simple("gpt-4o", "test");
        assertThrows(RuntimeException.class, () -> adapter.chat(request));
    }
}
```

- [ ] **Step 3.3: 跑测试**

```bash
./mvnw test -Dtest=OpenAiAdapterTest
```

Expected: 3 个测试全通过

- [ ] **Step 3.4: 提交**

```bash
git add src/main/java/com/metaplatform/ai/llm/adapter/OpenAiAdapter.java \
        src/test/java/com/metaplatform/ai/llm/OpenAiAdapterTest.java
git commit -m "feat(llm): add OpenAI adapter with MockWebServer tests"
```

---

## Task 4: LLM Gateway — Anthropic 适配器 + Gateway 实现

**Files:**
- Create: `src/main/java/com/metaplatform/ai/llm/adapter/AnthropicAdapter.java`
- Create: `src/main/java/com/metaplatform/ai/llm/LlmGatewayImpl.java`
- Test: `src/test/java/com/metaplatform/ai/llm/AnthropicAdapterTest.java`
- Test: `src/test/java/com/metaplatform/ai/llm/LlmGatewayImplTest.java`

- [ ] **Step 4.1: 写 AnthropicAdapter**

```java
package com.metaplatform.ai.llm.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ai.llm.LlmAdapter;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
public class AnthropicAdapter implements LlmAdapter {

    private static final Logger log = LoggerFactory.getLogger(AnthropicAdapter.class);

    private final String apiKey;
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;

    public AnthropicAdapter(
            @Value("${ai.anthropic.api-key}") String apiKey,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl,
            ObjectMapper mapper) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.mapper = mapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public String name() {
        return "anthropic";
    }

    @Override
    public boolean supportsModel(String model) {
        return model.startsWith("claude-");
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", request.model());
            body.put("max_tokens", request.maxTokens());
            body.put("temperature", request.temperature());

            // Anthropic 使用 messages 格式，system 消息单独处理
            String systemPrompt = request.messages().stream()
                    .filter(m -> "system".equals(m.role()))
                    .map(LlmRequest.ChatMessage::content)
                    .reduce("", (a, b) -> a + "\n" + b);

            if (!systemPrompt.isBlank()) {
                body.put("system", systemPrompt.trim());
            }

            ArrayNode messagesNode = body.putArray("messages");
            request.messages().stream()
                    .filter(m -> !"system".equals(m.role()))
                    .forEach(msg -> {
                        ObjectNode msgNode = messagesNode.addObject();
                        msgNode.put("role", msg.role());
                        msgNode.put("content", msg.content());
                    });

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/messages")
                    .addHeader("x-api-key", apiKey)
                    .addHeader("anthropic-version", "2023-06-01")
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("Anthropic API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("Anthropic API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode contentBlock = root.path("content").path(0);
                JsonNode usage = root.path("usage");

                return new LlmResponse(
                        root.path("id").asText(),
                        root.path("model").asText(),
                        contentBlock.path("text").asText(),
                        root.path("stop_reason").asText("end_turn"),
                        new LlmResponse.TokenUsage(
                                usage.path("input_tokens").asInt(0),
                                usage.path("output_tokens").asInt(0),
                                usage.path("input_tokens").asInt(0) + usage.path("output_tokens").asInt(0)
                        ),
                        Map.of()
                );
            }
        } catch (IOException e) {
            log.error("Failed to call Anthropic API: {}", e.getMessage(), e);
            throw new RuntimeException("Anthropic API call failed", e);
        }
    }
}
```

- [ ] **Step 4.2: 写 LlmGatewayImpl**

```java
package com.metaplatform.ai.llm;

import com.metaplatform.ai.billing.TokenBillingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LlmGatewayImpl implements LlmGateway {

    private static final Logger log = LoggerFactory.getLogger(LlmGatewayImpl.class);

    private final List<LlmAdapter> adapters;
    private final ModelAlias modelAlias;
    private final TokenBillingService billingService;

    public LlmGatewayImpl(List<LlmAdapter> adapters,
                           ModelAlias modelAlias,
                           TokenBillingService billingService) {
        this.adapters = adapters;
        this.modelAlias = modelAlias;
        this.billingService = billingService;
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        return chat(request, "default");
    }

    @Override
    public LlmResponse chat(LlmRequest request, String tenantId) {
        // 1. 解析模型别名
        String resolvedModel = modelAlias.resolve(request.model());

        // 2. 构建解析后的请求
        LlmRequest resolvedRequest = new LlmRequest(
                resolvedModel, request.messages(), request.temperature(),
                request.maxTokens(), request.extra());

        // 3. 查找支持该模型的适配器
        LlmAdapter adapter = findAdapter(resolvedModel);

        // 4. 调用 LLM
        log.info("Calling LLM: model={}, adapter={}, tenant={}", resolvedModel, adapter.name(), tenantId);
        LlmResponse response = adapter.chat(resolvedRequest);

        // 5. 记录 token 用量
        billingService.recordUsage(tenantId, resolvedModel,
                response.usage().promptTokens(), response.usage().completionTokens());

        return response;
    }

    private LlmAdapter findAdapter(String model) {
        return adapters.stream()
                .filter(a -> a.supportsModel(model))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "No LLM adapter found for model: " + model +
                        ". Available adapters: " + adapters.stream()
                                .map(LlmAdapter::name)
                                .toList()));
    }
}
```

- [ ] **Step 4.3: 写 AnthropicAdapter 测试**

`AnthropicAdapterTest.java`：

```java
package com.metaplatform.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.adapter.AnthropicAdapter;
import mockwebserver3.MockResponse;
import mockwebserver3.MockWebServer;
import mockwebserver3.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AnthropicAdapterTest {

    private MockWebServer mockServer;
    private AnthropicAdapter adapter;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        String baseUrl = mockServer.url("/v1").toString();
        adapter = new AnthropicAdapter("test-key", baseUrl, mapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldSupportClaudeModels() {
        assertTrue(adapter.supportsModel("claude-3-opus-20240229"));
        assertTrue(adapter.supportsModel("claude-3-sonnet-20240229"));
        assertTrue(adapter.supportsModel("claude-3-haiku-20240307"));
        assertFalse(adapter.supportsModel("gpt-4o"));
    }

    @Test
    void shouldCallAnthropicApi() throws Exception {
        String responseJson = """
            {
                "id": "msg-123",
                "model": "claude-3-sonnet-20240229",
                "content": [{"type": "text", "text": "Hello from Claude!"}],
                "stop_reason": "end_turn",
                "usage": {
                    "input_tokens": 10,
                    "output_tokens": 8
                }
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = LlmRequest.simple("claude-3-sonnet-20240229", "Hello");
        LlmResponse response = adapter.chat(request);

        assertEquals("msg-123", response.id());
        assertEquals("claude-3-sonnet-20240229", response.model());
        assertEquals("Hello from Claude!", response.content());
        assertEquals("end_turn", response.finishReason());
        assertEquals(18, response.usage().totalTokens());

        // 验证请求头
        RecordedRequest recorded = mockServer.takeRequest();
        assertEquals("test-key", recorded.getHeader("x-api-key"));
        assertEquals("2023-06-01", recorded.getHeader("anthropic-version"));
    }

    @Test
    void shouldExtractSystemPrompt() throws Exception {
        String responseJson = """
            {
                "id": "msg-456",
                "model": "claude-3-sonnet-20240229",
                "content": [{"type": "text", "text": "Understood"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 5, "output_tokens": 3}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = new LlmRequest(
                "claude-3-sonnet-20240229",
                List.of(
                        new LlmRequest.ChatMessage("system", "You are helpful."),
                        new LlmRequest.ChatMessage("user", "Hello")
                ),
                0.7, 1024, java.util.Map.of());

        adapter.chat(request);

        RecordedRequest recorded = mockServer.takeRequest();
        String body = recorded.getBody().readUtf8();
        assertTrue(body.contains("\"system\":\"You are helpful.\""));
    }
}
```

- [ ] **Step 4.4: 写 LlmGatewayImpl 测试**

`LlmGatewayImplTest.java`：

```java
package com.metaplatform.ai.llm;

import com.metaplatform.ai.billing.TokenBillingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LlmGatewayImplTest {

    @Mock
    private ModelAlias modelAlias;

    @Mock
    private TokenBillingService billingService;

    @Mock
    private LlmAdapter openAiAdapter;

    @Mock
    private LlmAdapter anthropicAdapter;

    private LlmGatewayImpl gateway;

    @BeforeEach
    void setUp() {
        gateway = new LlmGatewayImpl(
                List.of(openAiAdapter, anthropicAdapter),
                modelAlias,
                billingService);
    }

    @Test
    void shouldRouteToCorrectAdapter() {
        when(modelAlias.resolve("fast")).thenReturn("gpt-3.5-turbo");
        when(openAiAdapter.supportsModel("gpt-3.5-turbo")).thenReturn(true);
        when(openAiAdapter.chat(any())).thenReturn(
                new LlmResponse("id-1", "gpt-3.5-turbo", "Hi", "stop",
                        new LlmResponse.TokenUsage(10, 5, 15), Map.of()));

        LlmResponse response = gateway.chat(LlmRequest.simple("fast", "Hello"), "tenant-1");

        assertEquals("Hi", response.content());
        verify(billingService).recordUsage("tenant-1", "gpt-3.5-turbo", 10, 5);
    }

    @Test
    void shouldResolveModelAlias() {
        when(modelAlias.resolve("smart")).thenReturn("gpt-4o");
        when(openAiAdapter.supportsModel("gpt-4o")).thenReturn(true);
        when(openAiAdapter.chat(any())).thenReturn(
                new LlmResponse("id-2", "gpt-4o", "Result", "stop",
                        new LlmResponse.TokenUsage(20, 10, 30), Map.of()));

        gateway.chat(LlmRequest.simple("smart", "test"), "tenant-1");

        verify(modelAlias).resolve("smart");
        verify(openAiAdapter).chat(argThat(req -> "gpt-4o".equals(req.model())));
    }

    @Test
    void shouldThrowWhenNoAdapterFound() {
        when(modelAlias.resolve("unknown")).thenReturn("unknown-model");
        when(openAiAdapter.supportsModel("unknown-model")).thenReturn(false);
        when(anthropicAdapter.supportsModel("unknown-model")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () ->
                gateway.chat(LlmRequest.simple("unknown", "test")));
    }
}
```

- [ ] **Step 4.5: 跑测试**

```bash
./mvnw test -Dtest=AnthropicAdapterTest,LlmGatewayImplTest
```

Expected: 所有测试通过

- [ ] **Step 4.6: 提交**

```bash
git add src/main/java/com/metaplatform/ai/llm/adapter/AnthropicAdapter.java \
        src/main/java/com/metaplatform/ai/llm/LlmGatewayImpl.java \
        src/test/java/com/metaplatform/ai/llm/AnthropicAdapterTest.java \
        src/test/java/com/metaplatform/ai/llm/LlmGatewayImplTest.java
git commit -m "feat(llm): add Anthropic adapter and LlmGatewayImpl with routing + fallback"
```

---

## Task 5: Embedding Service — OpenAI ada-002

**Files:**
- Create: `src/main/java/com/metaplatform/ai/embedding/EmbeddingRequest.java`
- Create: `src/main/java/com/metaplatform/ai/embedding/EmbeddingResponse.java`
- Create: `src/main/java/com/metaplatform/ai/embedding/EmbeddingService.java`
- Create: `src/main/java/com/metaplatform/ai/embedding/OpenAiEmbeddingService.java`
- Test: `src/test/java/com/metaplatform/ai/embedding/OpenAiEmbeddingServiceTest.java`

- [ ] **Step 5.1: 写 DTO**

```java
package com.metaplatform.ai.embedding;

import java.util.List;

public record EmbeddingRequest(
    String model,
    List<String> texts
) {
    public EmbeddingRequest {
        if (texts == null || texts.isEmpty()) {
            throw new IllegalArgumentException("texts must not be empty");
        }
    }
}
```

```java
package com.metaplatform.ai.embedding;

import java.util.List;

public record EmbeddingResponse(
    String model,
    List<Embedding> embeddings
) {
    public record Embedding(
        int index,
        List<Float> vector
    ) {}
}
```

- [ ] **Step 5.2: 写 EmbeddingService 接口**

```java
package com.metaplatform.ai.embedding;

/**
 * Embedding 服务接口。
 */
public interface EmbeddingService {

    /**
     * 生成文本嵌入向量。
     */
    EmbeddingResponse embed(EmbeddingRequest request);

    /**
     * 生成嵌入并缓存到 Redis。
     */
    EmbeddingResponse embedWithCache(EmbeddingRequest request);
}
```

- [ ] **Step 5.3: 写 OpenAiEmbeddingService**

```java
package com.metaplatform.ai.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class OpenAiEmbeddingService implements EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingService.class);
    private static final String CACHE_PREFIX = "embedding:";
    private static final long CACHE_TTL_HOURS = 24;

    private final String apiKey;
    private final String baseUrl;
    private final String defaultModel;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;
    private final StringRedisTemplate redisTemplate;

    public OpenAiEmbeddingService(
            @Value("${ai.openai.api-key}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${ai.openai.embedding-model:text-embedding-ada-002}") String defaultModel,
            ObjectMapper mapper,
            StringRedisTemplate redisTemplate) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.defaultModel = defaultModel;
        this.mapper = mapper;
        this.redisTemplate = redisTemplate;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public EmbeddingResponse embed(EmbeddingRequest request) {
        String model = request.model() != null ? request.model() : defaultModel;

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            ArrayNode input = body.putArray("input");
            request.texts().forEach(input::add);

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/embeddings")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("OpenAI Embedding API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("OpenAI Embedding API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode data = root.path("data");

                List<EmbeddingResponse.Embedding> embeddings = new ArrayList<>();
                for (JsonNode item : data) {
                    int index = item.path("index").asInt();
                    List<Float> vector = new ArrayList<>();
                    for (JsonNode val : item.path("embedding")) {
                        vector.add(val.floatValue());
                    }
                    embeddings.add(new EmbeddingResponse.Embedding(index, vector));
                }

                return new EmbeddingResponse(root.path("model").asText(model), embeddings);
            }
        } catch (IOException e) {
            log.error("Failed to call OpenAI Embedding API: {}", e.getMessage(), e);
            throw new RuntimeException("Embedding API call failed", e);
        }
    }

    @Override
    public EmbeddingResponse embedWithCache(EmbeddingRequest request) {
        String model = request.model() != null ? request.model() : defaultModel;

        // 检查缓存
        List<String> uncachedTexts = new ArrayList<>();
        List<Integer> uncachedIndices = new ArrayList<>();
        List<EmbeddingResponse.Embedding> cachedResults = new ArrayList<>();

        for (int i = 0; i < request.texts().size(); i++) {
            String text = request.texts().get(i);
            String cacheKey = buildCacheKey(model, text);
            String cached = redisTemplate.opsForValue().get(cacheKey);

            if (cached != null) {
                try {
                    EmbeddingResponse.Embedding embedding = mapper.readValue(cached, EmbeddingResponse.Embedding.class);
                    cachedResults.add(new EmbeddingResponse.Embedding(i, embedding.vector()));
                } catch (Exception e) {
                    uncachedTexts.add(text);
                    uncachedIndices.add(i);
                }
            } else {
                uncachedTexts.add(text);
                uncachedIndices.add(i);
            }
        }

        // 调用 API 获取未缓存的
        if (!uncachedTexts.isEmpty()) {
            EmbeddingResponse apiResponse = embed(new EmbeddingRequest(model, uncachedTexts));

            // 写入缓存
            for (EmbeddingResponse.Embedding emb : apiResponse.embeddings()) {
                String cacheKey = buildCacheKey(model, uncachedTexts.get(emb.index()));
                try {
                    String json = mapper.writeValueAsString(emb);
                    redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_HOURS, TimeUnit.HOURS);
                } catch (Exception e) {
                    log.warn("Failed to cache embedding: {}", e.getMessage());
                }
                // 修正 index 为原始位置
                cachedResults.add(new EmbeddingResponse.Embedding(uncachedIndices.get(emb.index()), emb.vector()));
            }
        }

        // 按原始顺序排序
        cachedResults.sort((a, b) -> Integer.compare(a.index(), b.index()));

        return new EmbeddingResponse(model, cachedResults);
    }

    private String buildCacheKey(String model, String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest((model + ":" + text).getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return CACHE_PREFIX + sb.toString();
        } catch (Exception e) {
            return CACHE_PREFIX + text.hashCode();
        }
    }
}
```

- [ ] **Step 5.4: 写测试**

`OpenAiEmbeddingServiceTest.java`：

```java
package com.metaplatform.ai.embedding;

import com.fasterxml.jackson.databind.ObjectMapper;
import mockwebserver3.MockResponse;
import mockwebserver3.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OpenAiEmbeddingServiceTest {

    private MockWebServer mockServer;
    private OpenAiEmbeddingService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        String baseUrl = mockServer.url("/v1").toString();
        service = new OpenAiEmbeddingService("test-key", baseUrl,
                "text-embedding-ada-002", mapper, redisTemplate);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldGenerateEmbeddings() throws Exception {
        String responseJson = """
            {
                "object": "list",
                "data": [{
                    "object": "embedding",
                    "index": 0,
                    "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
                }],
                "model": "text-embedding-ada-002",
                "usage": {"prompt_tokens": 5, "total_tokens": 5}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        EmbeddingRequest request = new EmbeddingRequest("text-embedding-ada-002", List.of("Hello world"));
        EmbeddingResponse response = service.embed(request);

        assertEquals("text-embedding-ada-002", response.model());
        assertEquals(1, response.embeddings().size());
        assertEquals(5, response.embeddings().get(0).vector().size());
        assertEquals(0.1f, response.embeddings().get(0).vector().get(0), 0.001f);
    }

    @Test
    void shouldHandleBatchEmbeddings() throws Exception {
        String responseJson = """
            {
                "object": "list",
                "data": [
                    {"object": "embedding", "index": 0, "embedding": [0.1, 0.2]},
                    {"object": "embedding", "index": 1, "embedding": [0.3, 0.4]}
                ],
                "model": "text-embedding-ada-002",
                "usage": {"prompt_tokens": 10, "total_tokens": 10}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        EmbeddingRequest request = new EmbeddingRequest(null, List.of("Text 1", "Text 2"));
        EmbeddingResponse response = service.embed(request);

        assertEquals(2, response.embeddings().size());
    }
}
```

- [ ] **Step 5.5: 跑测试**

```bash
./mvnw test -Dtest=OpenAiEmbeddingServiceTest
```

Expected: 2 个测试全通过

- [ ] **Step 5.6: 提交**

```bash
git add src/main/java/com/metaplatform/ai/embedding/ \
        src/test/java/com/metaplatform/ai/embedding/OpenAiEmbeddingServiceTest.java
git commit -m "feat(embedding): add OpenAI ada-002 embedding service with Redis cache"
```

---

## Task 6: Context Store — Redis 滑动窗口

**Files:**
- Create: `src/main/java/com/metaplatform/ai/context/ContextStore.java`
- Create: `src/main/java/com/metaplatform/ai/context/RedisContextStore.java`
- Test: `src/test/java/com/metaplatform/ai/context/RedisContextStoreTest.java`

- [ ] **Step 6.1: 写 ContextStore 接口**

```java
package com.metaplatform.ai.context;

import com.metaplatform.ai.llm.LlmRequest;

import java.util.List;

/**
 * 上下文存储：管理 AI 对话的上下文窗口。
 * 使用 Redis List 实现滑动窗口，自动淘汰旧消息。
 */
public interface ContextStore {

    /**
     * 添加消息到上下文
     */
    void addMessage(String sessionId, LlmRequest.ChatMessage message);

    /**
     * 获取上下文中的所有消息（按时间顺序）
     */
    List<LlmRequest.ChatMessage> getMessages(String sessionId);

    /**
     * 获取最近 N 条消息
     */
    List<LlmRequest.ChatMessage> getRecentMessages(String sessionId, int limit);

    /**
     * 清除上下文
     */
    void clear(String sessionId);

    /**
     * 获取上下文中的消息数量
     */
    long getMessageCount(String sessionId);
}
```

- [ ] **Step 6.2: 写 RedisContextStore**

```java
package com.metaplatform.ai.context;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Redis 实现的上下文存储。
 * 使用 Redis List 存储消息，支持滑动窗口和 TTL 自动过期。
 */
@Service
public class RedisContextStore implements ContextStore {

    private static final Logger log = LoggerFactory.getLogger(RedisContextStore.class);

    private static final String KEY_PREFIX = "context:";
    private static final int MAX_MESSAGES = 100;  // 最大消息数
    private static final long TTL_HOURS = 24;     // 24 小时自动过期

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisContextStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void addMessage(String sessionId, LlmRequest.ChatMessage message) {
        String key = buildKey(sessionId);

        try {
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.opsForList().rightPush(key, json);

            // 维持滑动窗口大小
            Long size = redisTemplate.opsForList().size(key);
            if (size != null && size > MAX_MESSAGES) {
                redisTemplate.opsForList().trim(key, size - MAX_MESSAGES, size - 1);
            }

            // 刷新 TTL
            redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);

        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message: {}", e.getMessage());
        }
    }

    @Override
    public List<LlmRequest.ChatMessage> getMessages(String sessionId) {
        String key = buildKey(sessionId);
        List<String> jsonList = redisTemplate.opsForList().range(key, 0, -1);

        if (jsonList == null) return List.of();

        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        for (String json : jsonList) {
            try {
                messages.add(objectMapper.readValue(json, LlmRequest.ChatMessage.class));
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize message: {}", e.getMessage());
            }
        }
        return messages;
    }

    @Override
    public List<LlmRequest.ChatMessage> getRecentMessages(String sessionId, int limit) {
        String key = buildKey(sessionId);
        Long size = redisTemplate.opsForList().size(key);
        if (size == null || size == 0) return List.of();

        long start = Math.max(0, size - limit);
        List<String> jsonList = redisTemplate.opsForList().range(key, start, size - 1);

        if (jsonList == null) return List.of();

        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        for (String json : jsonList) {
            try {
                messages.add(objectMapper.readValue(json, LlmRequest.ChatMessage.class));
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize message: {}", e.getMessage());
            }
        }
        return messages;
    }

    @Override
    public void clear(String sessionId) {
        String key = buildKey(sessionId);
        redisTemplate.delete(key);
    }

    @Override
    public long getMessageCount(String sessionId) {
        String key = buildKey(sessionId);
        Long size = redisTemplate.opsForList().size(key);
        return size != null ? size : 0;
    }

    private String buildKey(String sessionId) {
        return KEY_PREFIX + sessionId;
    }
}
```

- [ ] **Step 6.3: 配置 RedisConfig**

```java
package com.metaplatform.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
```

- [ ] **Step 6.4: 提交**

```bash
git add src/main/java/com/metaplatform/ai/context/ContextStore.java \
        src/main/java/com/metaplatform/ai/context/RedisContextStore.java \
        src/main/java/com/metaplatform/ai/config/RedisConfig.java
git commit -m "feat(context): add Redis-based context store with sliding window and TTL"
```

---

## Task 7: In-Memory Vector Store — 余弦相似度搜索

**Files:**
- Create: `src/main/java/com/metaplatform/ai/vector/VectorStore.java`
- Create: `src/main/java/com/metaplatform/ai/vector/SearchResult.java`
- Create: `src/main/java/com/metaplatform/ai/vector/InMemoryVectorStore.java`
- Test: `src/test/java/com/metaplatform/ai/vector/InMemoryVectorStoreTest.java`

- [ ] **Step 7.1: 写 VectorStore 接口**

```java
package com.metaplatform.ai.vector;

import java.util.List;
import java.util.Map;

/**
 * 向量存储接口。
 * v0.1 使用内存实现，后续版本替换为 Milvus。
 */
public interface VectorStore {

    /**
     * 存储向量
     */
    void store(String collection, String id, List<Float> vector, Map<String, Object> metadata);

    /**
     * 批量存储
     */
    void storeBatch(String collection, List<VectorEntry> entries);

    /**
     * 相似度搜索（余弦相似度）
     */
    List<SearchResult> search(String collection, List<Float> queryVector, int topK);

    /**
     * 带过滤条件的相似度搜索
     */
    List<SearchResult> search(String collection, List<Float> queryVector, int topK,
                               Map<String, Object> filter);

    /**
     * 删除向量
     */
    void delete(String collection, String id);

    /**
     * 删除整个集合
     */
    void deleteCollection(String collection);

    /**
     * 获取集合中的向量数量
     */
    long count(String collection);

    record VectorEntry(
        String id,
        List<Float> vector,
        Map<String, Object> metadata
    ) {}
}
```

- [ ] **Step 7.2: 写 SearchResult**

```java
package com.metaplatform.ai.vector;

import java.util.Map;

/**
 * 向量搜索结果。
 */
public record SearchResult(
    String id,
    float score,                // 相似度分数 0.0-1.0
    Map<String, Object> metadata
) {
    /**
     * 创建带分数的结果
     */
    public static SearchResult of(String id, float score, Map<String, Object> metadata) {
        return new SearchResult(id, score, metadata);
    }
}
```

- [ ] **Step 7.3: 写 InMemoryVectorStore**

```java
package com.metaplatform.ai.vector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 内存向量存储：v0.1 的临时实现，替代 Milvus。
 * 使用余弦相似度进行搜索。
 */
@Component
public class InMemoryVectorStore implements VectorStore {

    private static final Logger log = LoggerFactory.getLogger(InMemoryVectorStore.class);

    /**
     * collection -> (id -> VectorDoc)
     */
    private final Map<String, Map<String, VectorDoc>> collections = new ConcurrentHashMap<>();

    @Override
    public void store(String collection, String id, List<Float> vector, Map<String, Object> metadata) {
        collections.computeIfAbsent(collection, k -> new ConcurrentHashMap<>())
                .put(id, new VectorDoc(id, vector, metadata != null ? metadata : Map.of()));
        log.debug("Stored vector in collection={}, id={}, dim={}", collection, id, vector.size());
    }

    @Override
    public void storeBatch(String collection, List<VectorEntry> entries) {
        Map<String, VectorDoc> store = collections.computeIfAbsent(collection, k -> new ConcurrentHashMap<>());
        for (VectorEntry entry : entries) {
            store.put(entry.id(), new VectorDoc(entry.id(), entry.vector(),
                    entry.metadata() != null ? entry.metadata() : Map.of()));
        }
        log.debug("Stored {} vectors in collection={}", entries.size(), collection);
    }

    @Override
    public List<SearchResult> search(String collection, List<Float> queryVector, int topK) {
        return search(collection, queryVector, topK, Map.of());
    }

    @Override
    public List<SearchResult> search(String collection, List<Float> queryVector, int topK,
                                      Map<String, Object> filter) {
        Map<String, VectorDoc> store = collections.get(collection);
        if (store == null || store.isEmpty()) {
            return List.of();
        }

        // 计算所有向量的余弦相似度
        List<SearchResult> results = store.values().stream()
                .filter(doc -> matchesFilter(doc.metadata(), filter))
                .map(doc -> {
                    float score = cosineSimilarity(queryVector, doc.vector());
                    return new SearchResult(doc.id(), score, doc.metadata());
                })
                .sorted((a, b) -> Float.compare(b.score(), a.score()))
                .limit(topK)
                .toList();

        log.debug("Search in collection={}, topK={}, found={} results", collection, topK, results.size());
        return results;
    }

    @Override
    public void delete(String collection, String id) {
        Map<String, VectorDoc> store = collections.get(collection);
        if (store != null) {
            store.remove(id);
        }
    }

    @Override
    public void deleteCollection(String collection) {
        collections.remove(collection);
    }

    @Override
    public long count(String collection) {
        Map<String, VectorDoc> store = collections.get(collection);
        return store != null ? store.size() : 0;
    }

    /**
     * 计算余弦相似度
     */
    static float cosineSimilarity(List<Float> a, List<Float> b) {
        if (a.size() != b.size()) {
            throw new IllegalArgumentException("Vector dimensions must match: " + a.size() + " vs " + b.size());
        }

        float dotProduct = 0;
        float normA = 0;
        float normB = 0;

        for (int i = 0; i < a.size(); i++) {
            float ai = a.get(i);
            float bi = b.get(i);
            dotProduct += ai * bi;
            normA += ai * ai;
            normB += bi * bi;
        }

        if (normA == 0 || normB == 0) return 0;

        return dotProduct / (float) (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private boolean matchesFilter(Map<String, Object> metadata, Map<String, Object> filter) {
        if (filter == null || filter.isEmpty()) return true;

        for (Map.Entry<String, Object> entry : filter.entrySet()) {
            Object metaValue = metadata.get(entry.getKey());
            if (!Objects.equals(metaValue, entry.getValue())) {
                return false;
            }
        }
        return true;
    }

    private record VectorDoc(
        String id,
        List<Float> vector,
        Map<String, Object> metadata
    ) {}
}
```

- [ ] **Step 7.4: 写测试**

`InMemoryVectorStoreTest.java`：

```java
package com.metaplatform.ai.vector;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryVectorStoreTest {

    private InMemoryVectorStore vectorStore;

    @BeforeEach
    void setUp() {
        vectorStore = new InMemoryVectorStore();
    }

    @Test
    void shouldStoreAndRetrieveVector() {
        List<Float> vector = List.of(0.1f, 0.2f, 0.3f);
        vectorStore.store("test-collection", "doc-1", vector, Map.of("type", "text"));

        assertEquals(1, vectorStore.count("test-collection"));
    }

    @Test
    void shouldSearchByCosineSimilarity() {
        // 存储几个向量
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f, 0.0f), Map.of("name", "Doc 1"));
        vectorStore.store("docs", "doc-2", List.of(0.0f, 1.0f, 0.0f), Map.of("name", "Doc 2"));
        vectorStore.store("docs", "doc-3", List.of(0.9f, 0.1f, 0.0f), Map.of("name", "Doc 3"));

        // 搜索与 [1, 0, 0] 最相似的向量
        List<SearchResult> results = vectorStore.search("docs", List.of(1.0f, 0.0f, 0.0f), 2);

        assertEquals(2, results.size());
        assertEquals("doc-1", results.get(0).id());
        assertTrue(results.get(0).score() > 0.99f); // 完全匹配
        assertEquals("doc-3", results.get(1).id()); // 次相似
    }

    @Test
    void shouldSearchWithFilter() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f),
                Map.of("category", "A", "name", "Doc 1"));
        vectorStore.store("docs", "doc-2", List.of(1.0f, 0.0f),
                Map.of("category", "B", "name", "Doc 2"));
        vectorStore.store("docs", "doc-3", List.of(1.0f, 0.0f),
                Map.of("category", "A", "name", "Doc 3"));

        List<SearchResult> results = vectorStore.search("docs", List.of(1.0f, 0.0f), 10,
                Map.of("category", "A"));

        assertEquals(2, results.size());
        assertTrue(results.stream().allMatch(r ->
                "A".equals(r.metadata().get("category"))));
    }

    @Test
    void shouldDeleteVector() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f), Map.of());
        assertEquals(1, vectorStore.count("docs"));

        vectorStore.delete("docs", "doc-1");
        assertEquals(0, vectorStore.count("docs"));
    }

    @Test
    void shouldDeleteCollection() {
        vectorStore.store("docs", "doc-1", List.of(1.0f), Map.of());
        vectorStore.store("docs", "doc-2", List.of(0.0f), Map.of());

        vectorStore.deleteCollection("docs");
        assertEquals(0, vectorStore.count("docs"));
    }

    @Test
    void shouldReturnEmptyForNonexistentCollection() {
        List<SearchResult> results = vectorStore.search("nonexistent", List.of(1.0f), 10);
        assertTrue(results.isEmpty());
    }

    @Test
    void shouldBatchStore() {
        List<VectorStore.VectorEntry> entries = List.of(
                new VectorStore.VectorEntry("a", List.of(1.0f, 0.0f), Map.of("key", "a")),
                new VectorStore.VectorEntry("b", List.of(0.0f, 1.0f), Map.of("key", "b"))
        );

        vectorStore.storeBatch("batch-test", entries);
        assertEquals(2, vectorStore.count("batch-test"));
    }

    @Test
    void shouldRejectDimensionMismatch() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f), Map.of());

        assertThrows(IllegalArgumentException.class, () ->
                vectorStore.search("docs", List.of(1.0f, 0.0f, 0.0f), 10));
    }
}
```

- [ ] **Step 7.5: 跑测试**

```bash
./mvnw test -Dtest=InMemoryVectorStoreTest
```

Expected: 8 个测试全通过

- [ ] **Step 7.6: 提交**

```bash
git add src/main/java/com/metaplatform/ai/vector/ \
        src/test/java/com/metaplatform/ai/vector/InMemoryVectorStoreTest.java
git commit -m "feat(vector): add InMemoryVectorStore with cosine similarity search (v0.1)"
```

---

## Task 8: Agent Runtime — 单步 Tool Calling

**Files:**
- Create: `src/main/java/com/metaplatform/ai/agent/ToolDefinition.java`
- Create: `src/main/java/com/metaplatform/ai/agent/ToolExecutor.java`
- Create: `src/main/java/com/metaplatform/ai/agent/AgentRequest.java`
- Create: `src/main/java/com/metaplatform/ai/agent/AgentResponse.java`
- Create: `src/main/java/com/metaplatform/ai/agent/AgentRuntime.java`
- Test: `src/test/java/com/metaplatform/ai/agent/AgentRuntimeTest.java`

- [ ] **Step 8.1: 写 ToolDefinition**

```java
package com.metaplatform.ai.agent;

import java.util.Map;

/**
 * 工具定义：描述 Agent 可调用的工具。
 */
public record ToolDefinition(
    String name,                    // 工具名称
    String description,             // 工具描述（供 LLM 理解）
    Map<String, Object> parameters  // 参数 JSON Schema
) {
    public ToolDefinition {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("tool name must not be blank");
        }
        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException("tool description must not be blank");
        }
    }
}
```

- [ ] **Step 8.2: 写 ToolExecutor 接口**

```java
package com.metaplatform.ai.agent;

import java.util.Map;

/**
 * 工具执行器接口：每个工具实现一个执行器。
 */
public interface ToolExecutor {

    /** 工具名称（与 ToolDefinition 对应） */
    String toolName();

    /** 执行工具 */
    String execute(Map<String, Object> arguments);
}
```

- [ ] **Step 8.3: 写 AgentRequest + AgentResponse**

```java
package com.metaplatform.ai.agent;

import com.metaplatform.ai.llm.LlmRequest;

import java.util.List;
import java.util.Map;

public record AgentRequest(
    String model,                       // 使用的 LLM 模型
    String systemPrompt,                // 系统提示词
    String userMessage,                 // 用户消息
    List<ToolDefinition> tools,         // 可用工具列表
    Map<String, Object> context         // 额外上下文
) {
    public AgentRequest {
        if (userMessage == null || userMessage.isBlank()) {
            throw new IllegalArgumentException("userMessage must not be blank");
        }
    }
}
```

```java
package com.metaplatform.ai.agent;

import java.util.Map;

public record AgentResponse(
    String content,                     // 最终回复内容
    String toolUsed,                    // 调用的工具名（null 表示未使用工具）
    Map<String, Object> toolArguments,  // 工具参数
    String toolResult,                  // 工具执行结果
    TokenUsage usage
) {
    public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens
    ) {}
}
```

- [ ] **Step 8.4: 写 AgentRuntime**

```java
package com.metaplatform.ai.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Agent 运行时：单步 tool calling。
 * 
 * 流程：
 * 1. 构建包含工具定义的 system prompt
 * 2. 调用 LLM
 * 3. 如果 LLM 返回 tool_calls，执行工具并返回结果
 * 4. 如果 LLM 返回普通文本，直接返回
 */
@Service
public class AgentRuntime {

    private static final Logger log = LoggerFactory.getLogger(AgentRuntime.class);

    private final LlmGateway llmGateway;
    private final List<ToolExecutor> toolExecutors;
    private final ObjectMapper mapper;

    public AgentRuntime(LlmGateway llmGateway, List<ToolExecutor> toolExecutors, ObjectMapper mapper) {
        this.llmGateway = llmGateway;
        this.toolExecutors = toolExecutors;
        this.mapper = mapper;
    }

    /**
     * 执行 Agent 请求（单步 tool calling）
     */
    public AgentResponse execute(AgentRequest request, String tenantId) {
        // 1. 构建包含工具描述的 system prompt
        String enhancedSystemPrompt = buildEnhancedSystemPrompt(request);

        // 2. 构建消息列表
        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        messages.add(new LlmRequest.ChatMessage("system", enhancedSystemPrompt));
        messages.add(new LlmRequest.ChatMessage("user", request.userMessage()));

        // 3. 调用 LLM
        LlmRequest llmRequest = new LlmRequest(
                request.model() != null ? request.model() : "smart",
                messages,
                0.7,
                2048,
                Map.of()
        );

        LlmResponse llmResponse = llmGateway.chat(llmRequest, tenantId);

        // 4. 检查是否需要调用工具
        String content = llmResponse.content();

        // v0.1 简化：检查内容中是否包含工具调用指令（JSON 格式）
        if (content.contains("\"tool_call\"") && content.contains("\"name\"")) {
            try {
                return handleToolCall(content, request, tenantId, llmResponse);
            } catch (Exception e) {
                log.warn("Failed to parse tool call: {}", e.getMessage());
                // 回退到直接返回 LLM 响应
            }
        }

        // 5. 直接返回文本响应
        return new AgentResponse(
                content,
                null,
                null,
                null,
                new AgentResponse.TokenUsage(
                        llmResponse.usage().promptTokens(),
                        llmResponse.usage().completionTokens(),
                        llmResponse.usage().totalTokens()
                )
        );
    }

    private AgentResponse handleToolCall(String content, AgentRequest request,
                                          String tenantId, LlmResponse llmResponse) {
        // 解析工具调用
        JsonNode root = mapper.readTree(extractJson(content));
        String toolName = root.path("name").asText();
        JsonNode argsNode = root.path("arguments");
        Map<String, Object> arguments = mapper.convertValue(argsNode, Map.class);

        log.info("Agent requesting tool call: tool={}, args={}", toolName, arguments);

        // 查找并执行工具
        ToolExecutor executor = toolExecutors.stream()
                .filter(e -> e.toolName().equals(toolName))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Tool not found: " + toolName));

        String toolResult = executor.execute(arguments);

        log.info("Tool execution result: tool={}, resultLength={}", toolName, toolResult.length());

        return new AgentResponse(
                toolResult,
                toolName,
                arguments,
                toolResult,
                new AgentResponse.TokenUsage(
                        llmResponse.usage().promptTokens(),
                        llmResponse.usage().completionTokens(),
                        llmResponse.usage().totalTokens()
                )
        );
    }

    private String buildEnhancedSystemPrompt(AgentRequest request) {
        StringBuilder sb = new StringBuilder();

        if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
            sb.append(request.systemPrompt()).append("\n\n");
        }

        if (request.tools() != null && !request.tools().isEmpty()) {
            sb.append("## Available Tools\n\n");
            sb.append("You have access to the following tools. To use a tool, respond with a JSON object:\n");
            sb.append("{\"tool_call\": true, \"name\": \"<tool_name>\", \"arguments\": {<args>}}\n\n");

            for (ToolDefinition tool : request.tools()) {
                sb.append("### ").append(tool.name()).append("\n");
                sb.append("**Description:** ").append(tool.description()).append("\n");
                if (tool.parameters() != null && !tool.parameters().isEmpty()) {
                    sb.append("**Parameters:** ").append(mapper.valueToTree(tool.parameters())).append("\n");
                }
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private String extractJson(String content) {
        // 提取 JSON 部分（简单实现）
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return content.substring(start, end + 1);
        }
        return content;
    }
}
```

- [ ] **Step 8.5: 写测试**

`AgentRuntimeTest.java`：

```java
package com.metaplatform.ai.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentRuntimeTest {

    @Mock
    private LlmGateway llmGateway;

    private AgentRuntime agentRuntime;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ToolExecutor calculatorTool = new ToolExecutor() {
            @Override
            public String toolName() { return "calculator"; }

            @Override
            public String execute(Map<String, Object> arguments) {
                String expression = (String) arguments.get("expression");
                // 简单计算
                if ("2+2".equals(expression)) return "4";
                return "unknown";
            }
        };

        agentRuntime = new AgentRuntime(llmGateway, List.of(calculatorTool), mapper);
    }

    @Test
    void shouldReturnDirectResponseWithoutToolCall() {
        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-1", "gpt-4o", "Hello! How can I help you?", "stop",
                        new LlmResponse.TokenUsage(100, 20, 120), Map.of()));

        AgentRequest request = new AgentRequest("smart", "You are helpful.", "Hi", List.of(), Map.of());
        AgentResponse response = agentRuntime.execute(request, "tenant-1");

        assertEquals("Hello! How can I help you?", response.content());
        assertNull(response.toolUsed());
    }

    @Test
    void shouldExecuteToolWhenRequested() {
        String toolCallResponse = """
            I'll calculate that for you.
            {"tool_call": true, "name": "calculator", "arguments": {"expression": "2+2"}}
            """;

        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-2", "gpt-4o", toolCallResponse, "stop",
                        new LlmResponse.TokenUsage(150, 50, 200), Map.of()));

        ToolDefinition calcTool = new ToolDefinition("calculator", "Perform calculations", Map.of());
        AgentRequest request = new AgentRequest("smart", null, "What is 2+2?",
                List.of(calcTool), Map.of());

        AgentResponse response = agentRuntime.execute(request, "tenant-1");

        assertEquals("calculator", response.toolUsed());
        assertEquals("4", response.toolResult());
        assertNotNull(response.toolArguments());
    }

    @Test
    void shouldThrowOnUnknownTool() {
        String toolCallResponse = """
            {"tool_call": true, "name": "unknown_tool", "arguments": {}}
            """;

        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-3", "gpt-4o", toolCallResponse, "stop",
                        new LlmResponse.TokenUsage(100, 30, 130), Map.of()));

        AgentRequest request = new AgentRequest("smart", null, "Do something",
                List.of(), Map.of());

        assertThrows(IllegalArgumentException.class, () ->
                agentRuntime.execute(request, "tenant-1"));
    }
}
```

- [ ] **Step 8.6: 跑测试**

```bash
./mvnw test -Dtest=AgentRuntimeTest
```

Expected: 3 个测试全通过

- [ ] **Step 8.7: 提交**

```bash
git add src/main/java/com/metaplatform/ai/agent/ \
        src/test/java/com/metaplatform/ai/agent/AgentRuntimeTest.java
git commit -m "feat(agent): add AgentRuntime with single-step tool calling"
```

---

## Task 9: Token Billing — 内存计数器 + 每日配额

**Files:**
- Create: `src/main/java/com/metaplatform/ai/billing/TokenUsage.java`
- Create: `src/main/java/com/metaplatform/ai/billing/BillingRepository.java`
- Create: `src/main/java/com/metaplatform/ai/billing/TokenBillingService.java`
- Create: `src/main/resources/db/migration/V1__init_ai_substrate.sql`
- Test: `src/test/java/com/metaplatform/ai/billing/TokenBillingServiceTest.java`

- [ ] **Step 9.1: 写 TokenUsage 实体**

```java
package com.metaplatform.ai.billing;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "token_usage")
public class TokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private String model;

    @Column(nullable = false)
    private int promptTokens;

    @Column(nullable = false)
    private int completionTokens;

    @Column(nullable = false)
    private int totalTokens;

    @Column(nullable = false)
    private LocalDate usageDate;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected TokenUsage() {} // JPA

    public TokenUsage(UUID tenantId, String model, int promptTokens, int completionTokens) {
        this.tenantId = tenantId;
        this.model = model;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.totalTokens = promptTokens + completionTokens;
        this.usageDate = LocalDate.now();
        this.createdAt = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getModel() { return model; }
    public int getPromptTokens() { return promptTokens; }
    public int getCompletionTokens() { return completionTokens; }
    public int getTotalTokens() { return totalTokens; }
    public LocalDate getUsageDate() { return usageDate; }
}
```

- [ ] **Step 9.2: 写 BillingRepository**

```java
package com.metaplatform.ai.billing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface BillingRepository extends JpaRepository<TokenUsage, Long> {

    @Query("SELECT SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate = :date")
    Integer sumTotalTokensByTenantAndDate(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    @Query("SELECT SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate BETWEEN :from AND :to")
    Integer sumTotalTokensByTenantAndDateRange(@Param("tenantId") UUID tenantId,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);

    @Query("SELECT t.model, SUM(t.totalTokens) FROM TokenUsage t WHERE t.tenantId = :tenantId AND t.usageDate = :date GROUP BY t.model")
    List<Object[]> sumTokensByModelAndDate(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

    List<TokenUsage> findByTenantIdAndUsageDate(UUID tenantId, LocalDate date);
}
```

- [ ] **Step 9.3: 写 TokenBillingService**

```java
package com.metaplatform.ai.billing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Token 计费服务：
 * - 内存计数器（实时统计，低延迟）
 * - Redis 分布式计数器（多实例共享）
 * - PG 持久化（每日汇总）
 * - 每日配额检查
 */
@Service
public class TokenBillingService {

    private static final Logger log = LoggerFactory.getLogger(TokenBillingService.class);
    private static final String REDIS_PREFIX = "billing:tokens:";
    private static final long REDIS_TTL_HOURS = 48;

    private final BillingRepository billingRepository;
    private final StringRedisTemplate redisTemplate;
    private final long dailyQuotaPerTenant;

    /**
     * 内存计数器：tenantId -> (date -> totalTokens)
     */
    private final Map<String, Map<String, Long>> inMemoryCounters = new ConcurrentHashMap<>();

    public TokenBillingService(BillingRepository billingRepository,
                               StringRedisTemplate redisTemplate,
                               @Value("${ai.billing.daily-quota-per-tenant:1000000}") long dailyQuotaPerTenant) {
        this.billingRepository = billingRepository;
        this.redisTemplate = redisTemplate;
        this.dailyQuotaPerTenant = dailyQuotaPerTenant;
    }

    /**
     * 记录 token 使用量。
     * 写入内存计数器 + Redis 计数器 + PG（异步/批量）。
     */
    public void recordUsage(String tenantId, String model, int promptTokens, int completionTokens) {
        int totalTokens = promptTokens + completionTokens;
        String today = LocalDate.now().toString();

        // 1. 内存计数器
        inMemoryCounters
                .computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>())
                .merge(today, (long) totalTokens, Long::sum);

        // 2. Redis 计数器
        String redisKey = buildRedisKey(tenantId, today);
        redisTemplate.opsForValue().increment(redisKey, totalTokens);
        redisTemplate.expire(redisKey, REDIS_TTL_HOURS, TimeUnit.HOURS);

        // 3. PG 持久化（v0.1 同步写入，后续优化为批量）
        try {
            TokenUsage usage = new TokenUsage(
                    UUID.fromString(tenantId), model, promptTokens, completionTokens);
            billingRepository.save(usage);
        } catch (Exception e) {
            log.error("Failed to persist token usage: {}", e.getMessage());
        }

        log.debug("Recorded token usage: tenant={}, model={}, prompt={}, completion={}, total={}",
                tenantId, model, promptTokens, completionTokens, totalTokens);
    }

    /**
     * 检查是否超过每日配额
     */
    public boolean isQuotaExceeded(String tenantId) {
        long usage = getDailyUsage(tenantId);
        return usage >= dailyQuotaPerTenant;
    }

    /**
     * 获取今日使用量（内存优先，Redis 回退）
     */
    public long getDailyUsage(String tenantId) {
        String today = LocalDate.now().toString();

        // 1. 尝试内存
        Map<String, Long> tenantCounters = inMemoryCounters.get(tenantId);
        if (tenantCounters != null && tenantCounters.containsKey(today)) {
            return tenantCounters.get(today);
        }

        // 2. 尝试 Redis
        try {
            String redisKey = buildRedisKey(tenantId, today);
            String value = redisTemplate.opsForValue().get(redisKey);
            if (value != null) {
                return Long.parseLong(value);
            }
        } catch (Exception e) {
            log.warn("Failed to read from Redis: {}", e.getMessage());
        }

        // 3. 查询 PG
        try {
            Integer sum = billingRepository.sumTotalTokensByTenantAndDate(
                    UUID.fromString(tenantId), LocalDate.now());
            return sum != null ? sum : 0;
        } catch (Exception e) {
            log.warn("Failed to query PG: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * 获取使用量汇总
     */
    public BillingSummary getSummary(String tenantId) {
        long dailyUsage = getDailyUsage(tenantId);
        LocalDate today = LocalDate.now();

        // 按模型统计
        Map<String, Long> byModel = new HashMap<>();
        try {
            List<Object[]> modelStats = billingRepository.sumTokensByModelAndDate(
                    UUID.fromString(tenantId), today);
            for (Object[] row : modelStats) {
                byModel.put((String) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception e) {
            log.warn("Failed to query model stats: {}", e.getMessage());
        }

        return new BillingSummary(
                tenantId,
                today.toString(),
                dailyUsage,
                dailyQuotaPerTenant,
                dailyQuotaPerTenant - dailyUsage,
                byModel
        );
    }

    /**
     * 使用量汇总
     */
    public record BillingSummary(
        String tenantId,
        String date,
        long dailyUsage,
        long dailyQuota,
        long remainingQuota,
        Map<String, Long> usageByModel
    ) {}

    private String buildRedisKey(String tenantId, String date) {
        return REDIS_PREFIX + tenantId + ":" + date;
    }
}
```

- [ ] **Step 9.4: 写 Flyway 迁移 V1**

`src/main/resources/db/migration/V1__init_ai_substrate.sql`：

```sql
-- Token 使用量表
CREATE TABLE token_usage (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    model VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_usage_tenant_date ON token_usage(tenant_id, usage_date);
CREATE INDEX idx_token_usage_model ON token_usage(tenant_id, model);
```

- [ ] **Step 9.5: 写测试**

`TokenBillingServiceTest.java`：

```java
package com.metaplatform.ai.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenBillingServiceTest {

    @Mock
    private BillingRepository billingRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private TokenBillingService billingService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        billingService = new TokenBillingService(billingRepository, redisTemplate, 1000000);
    }

    @Test
    void shouldRecordUsage() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        billingService.recordUsage("tenant-1", "gpt-4o", 100, 50);

        verify(billingRepository).save(any(TokenUsage.class));
        verify(valueOperations).increment(anyString(), eq(150L));
    }

    @Test
    void shouldTrackDailyUsageInMemory() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        billingService.recordUsage("tenant-1", "gpt-4o", 100, 50);
        billingService.recordUsage("tenant-1", "gpt-3.5-turbo", 200, 100);

        long usage = billingService.getDailyUsage("tenant-1");
        assertEquals(450, usage); // 150 + 300
    }

    @Test
    void shouldCheckQuotaNotExceeded() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(valueOperations.get(anyString())).thenReturn("500000");

        assertFalse(billingService.isQuotaExceeded("tenant-1"));
    }

    @Test
    void shouldCheckQuotaExceeded() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(valueOperations.get(anyString())).thenReturn("1000001");

        assertTrue(billingService.isQuotaExceeded("tenant-1"));
    }

    @Test
    void shouldReturnSummary() {
        when(billingRepository.sumTokensByModelAndDate(any(), any()))
                .thenReturn(java.util.List.of(
                        new Object[]{"gpt-4o", 5000},
                        new Object[]{"gpt-3.5-turbo", 3000}
                ));

        TokenBillingService.BillingSummary summary = billingService.getSummary("tenant-1");

        assertEquals("tenant-1", summary.tenantId());
        assertEquals(1000000, summary.dailyQuota());
        assertFalse(summary.usageByModel().isEmpty());
    }
}
```

- [ ] **Step 9.6: 跑测试**

```bash
./mvnw test -Dtest=TokenBillingServiceTest
```

Expected: 5 个测试全通过

- [ ] **Step 9.7: 提交**

```bash
git add src/main/java/com/metaplatform/ai/billing/ \
        src/main/resources/db/migration/V1__init_ai_substrate.sql \
        src/test/java/com/metaplatform/ai/billing/TokenBillingServiceTest.java
git commit -m "feat(billing): add TokenBillingService with in-memory counter and daily quota"
```

---

## Task 10: REST API — 全部 5 个 Controller

**Files:**
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/LlmController.java`
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/EmbeddingController.java`
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/ContextController.java`
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/AgentController.java`
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/BillingController.java`
- Create: `src/main/java/com/metaplatform/ai/interfaces/rest/dto/` (all DTOs)

- [ ] **Step 10.1: 写 DTO**

`ChatRequest.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record ChatRequest(
    String model,
    List<Message> messages,
    Double temperature,
    Integer maxTokens
) {
    public record Message(String role, String content) {}
}
```

`ChatResponse.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.Map;

public record ChatResponse(
    String id,
    String model,
    String content,
    String finishReason,
    int promptTokens,
    int completionTokens,
    int totalTokens
) {}
```

`EmbeddingApiRequest.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record EmbeddingApiRequest(
    String model,
    List<String> texts
) {}
```

`EmbeddingApiResponse.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record EmbeddingApiResponse(
    String model,
    List<List<Float>> embeddings
) {}
```

`ContextApiRequest.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

public record ContextApiRequest(
    String role,
    String content
) {}
```

`AgentApiRequest.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;
import java.util.Map;

public record AgentApiRequest(
    String model,
    String systemPrompt,
    String userMessage,
    List<ToolSpec> tools
) {
    public record ToolSpec(
        String name,
        String description,
        Map<String, Object> parameters
    ) {}
}
```

`BillingSummary.java`：

```java
package com.metaplatform.ai.interfaces.rest.dto;

import java.util.Map;

public record BillingSummary(
    String tenantId,
    String date,
    long dailyUsage,
    long dailyQuota,
    long remainingQuota,
    Map<String, Long> usageByModel
) {}
```

- [ ] **Step 10.2: 写 LlmController**

```java
package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.billing.TokenBillingService;
import com.metaplatform.ai.interfaces.rest.dto.ChatRequest;
import com.metaplatform.ai.interfaces.rest.dto.ChatResponse;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/llm")
public class LlmController {

    private final LlmGateway llmGateway;
    private final TokenBillingService billingService;

    public LlmController(LlmGateway llmGateway, TokenBillingService billingService) {
        this.llmGateway = llmGateway;
        this.billingService = billingService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            @RequestParam(defaultValue = "default") String tenantId) {

        // 检查配额
        if (billingService.isQuotaExceeded(tenantId)) {
            return ResponseEntity.status(429).build();
        }

        List<LlmRequest.ChatMessage> messages = request.messages().stream()
                .map(m -> new LlmRequest.ChatMessage(m.role(), m.content()))
                .toList();

        LlmRequest llmRequest = new LlmRequest(
                request.model() != null ? request.model() : "smart",
                messages,
                request.temperature() != null ? request.temperature() : 0.7,
                request.maxTokens() != null ? request.maxTokens() : 1024,
                java.util.Map.of()
        );

        LlmResponse response = llmGateway.chat(llmRequest, tenantId);

        return ResponseEntity.ok(new ChatResponse(
                response.id(),
                response.model(),
                response.content(),
                response.finishReason(),
                response.usage().promptTokens(),
                response.usage().completionTokens(),
                response.usage().totalTokens()
        ));
    }
}
```

- [ ] **Step 10.3: 写 EmbeddingController**

```java
package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.embedding.EmbeddingRequest;
import com.metaplatform.ai.embedding.EmbeddingResponse;
import com.metaplatform.ai.embedding.EmbeddingService;
import com.metaplatform.ai.interfaces.rest.dto.EmbeddingApiRequest;
import com.metaplatform.ai.interfaces.rest.dto.EmbeddingApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/embeddings")
public class EmbeddingController {

    private final EmbeddingService embeddingService;

    public EmbeddingController(EmbeddingService embeddingService) {
        this.embeddingService = embeddingService;
    }

    @PostMapping
    public ResponseEntity<EmbeddingApiResponse> embed(
            @Valid @RequestBody EmbeddingApiRequest request,
            @RequestParam(defaultValue = "false") boolean useCache) {

        EmbeddingRequest embRequest = new EmbeddingRequest(request.model(), request.texts());
        EmbeddingResponse response = useCache ?
                embeddingService.embedWithCache(embRequest) :
                embeddingService.embed(embRequest);

        List<List<Float>> vectors = response.embeddings().stream()
                .map(EmbeddingResponse.Embedding::vector)
                .toList();

        return ResponseEntity.ok(new EmbeddingApiResponse(response.model(), vectors));
    }
}
```

- [ ] **Step 10.4: 写 ContextController**

```java
package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.context.ContextStore;
import com.metaplatform.ai.interfaces.rest.dto.ContextApiRequest;
import com.metaplatform.ai.llm.LlmRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/context")
public class ContextController {

    private final ContextStore contextStore;

    public ContextController(ContextStore contextStore) {
        this.contextStore = contextStore;
    }

    @PostMapping("/{sessionId}/messages")
    public ResponseEntity<Void> addMessage(
            @PathVariable String sessionId,
            @RequestBody ContextApiRequest request) {
        contextStore.addMessage(sessionId, new LlmRequest.ChatMessage(request.role(), request.content()));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<List<Map<String, String>>> getMessages(
            @PathVariable String sessionId,
            @RequestParam(required = false) Integer limit) {

        List<LlmRequest.ChatMessage> messages = limit != null ?
                contextStore.getRecentMessages(sessionId, limit) :
                contextStore.getMessages(sessionId);

        List<Map<String, String>> result = messages.stream()
                .map(m -> Map.of("role", m.role(), "content", m.content()))
                .toList();

        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> clearContext(@PathVariable String sessionId) {
        contextStore.clear(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{sessionId}/count")
    public ResponseEntity<Map<String, Object>> getCount(@PathVariable String sessionId) {
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "count", contextStore.getMessageCount(sessionId)));
    }
}
```

- [ ] **Step 10.5: 写 AgentController**

```java
package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.agent.*;
import com.metaplatform.ai.interfaces.rest.dto.AgentApiRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {

    private final AgentRuntime agentRuntime;

    public AgentController(AgentRuntime agentRuntime) {
        this.agentRuntime = agentRuntime;
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> execute(
            @Valid @RequestBody AgentApiRequest request,
            @RequestParam(defaultValue = "default") String tenantId) {

        List<ToolDefinition> tools = request.tools() != null ?
                request.tools().stream()
                        .map(t -> new ToolDefinition(t.name(), t.description(), t.parameters()))
                        .toList() :
                List.of();

        AgentRequest agentRequest = new AgentRequest(
                request.model(),
                request.systemPrompt(),
                request.userMessage(),
                tools,
                Map.of()
        );

        AgentResponse response = agentRuntime.execute(agentRequest, tenantId);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("content", response.content());
        result.put("toolUsed", response.toolUsed());
        result.put("toolArguments", response.toolArguments());
        result.put("toolResult", response.toolResult());
        if (response.usage() != null) {
            result.put("usage", Map.of(
                    "promptTokens", response.usage().promptTokens(),
                    "completionTokens", response.usage().completionTokens(),
                    "totalTokens", response.usage().totalTokens()
            ));
        }

        return ResponseEntity.ok(result);
    }
}
```

- [ ] **Step 10.6: 写 BillingController**

```java
package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.billing.TokenBillingService;
import com.metaplatform.ai.interfaces.rest.dto.BillingSummary;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

    private final TokenBillingService billingService;

    public BillingController(TokenBillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/usage/{tenantId}")
    public ResponseEntity<Map<String, Object>> getUsage(@PathVariable String tenantId) {
        long usage = billingService.getDailyUsage(tenantId);
        return ResponseEntity.ok(Map.of(
                "tenantId", tenantId,
                "dailyUsage", usage
        ));
    }

    @GetMapping("/quota/{tenantId}")
    public ResponseEntity<Map<String, Object>> checkQuota(@PathVariable String tenantId) {
        boolean exceeded = billingService.isQuotaExceeded(tenantId);
        return ResponseEntity.ok(Map.of(
                "tenantId", tenantId,
                "quotaExceeded", exceeded
        ));
    }

    @GetMapping("/summary/{tenantId}")
    public ResponseEntity<BillingSummary> getSummary(@PathVariable String tenantId) {
        TokenBillingService.BillingSummary summary = billingService.getSummary(tenantId);
        return ResponseEntity.ok(new BillingSummary(
                summary.tenantId(),
                summary.date(),
                summary.dailyUsage(),
                summary.dailyQuota(),
                summary.remainingQuota(),
                summary.usageByModel()
        ));
    }
}
```

- [ ] **Step 10.7: 提交**

```bash
git add src/main/java/com/metaplatform/ai/interfaces/rest/ \
        src/main/java/com/metaplatform/ai/interfaces/rest/dto/
git commit -m "feat(api): add REST APIs for LLM, Embedding, Context, Agent, Billing"
```

---

## Task 11: Spring Boot 入口 + 应用配置

**Files:**
- Create: `src/main/java/com/metaplatform/ai/AiSubstrateApplication.java`
- Create: `src/main/java/com/metaplatform/ai/config/RestTemplateConfig.java`

- [ ] **Step 11.1: 写 Spring Boot 入口**

```java
package com.metaplatform.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories
public class AiSubstrateApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiSubstrateApplication.class, args);
    }
}
```

- [ ] **Step 11.2: 写 RestTemplateConfig**

```java
package com.metaplatform.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

- [ ] **Step 11.3: 提交**

```bash
git add src/main/java/com/metaplatform/ai/AiSubstrateApplication.java \
        src/main/java/com/metaplatform/ai/config/RestTemplateConfig.java
git commit -m "chore: add Spring Boot entry point and config"
```

---

## Task 12: 端到端验证 — 构建、启动、手动测试

- [ ] **Step 12.1: 编译整个项目**

```bash
cd metaplatform-ai-substrate
./mvnw clean compile
```

Expected: BUILD SUCCESS

- [ ] **Step 12.2: 跑全部单元测试**

```bash
./mvnw test
```

Expected: 所有测试通过

- [ ] **Step 12.3: 启动基础设施**

```bash
docker-compose up -d
sleep 10
docker ps
```

Expected: 2 个容器运行

- [ ] **Step 12.4: 启动应用**

```bash
OPENAI_API_KEY=your-key ANTHROPIC_API_KEY=your-key ./mvnw spring-boot:run
```

Expected: 应用启动成功

- [ ] **Step 12.5: 手动测试 — LLM Chat**

```bash
curl -X POST http://localhost:8083/api/v1/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "Hello, who are you?"}
    ],
    "temperature": 0.7,
    "maxTokens": 100
  }'
```

Expected: 200 OK，返回 LLM 回复

- [ ] **Step 12.6: 手动测试 — Embedding**

```bash
curl -X POST http://localhost:8083/api/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-ada-002",
    "texts": ["Hello world", "This is a test"]
  }'
```

Expected: 200 OK，返回嵌入向量

- [ ] **Step 12.7: 手动测试 — Context Store**

```bash
# 添加消息
curl -X POST http://localhost:8083/api/v1/context/session-1/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Hello"}'

# 查询消息
curl http://localhost:8083/api/v1/context/session-1/messages

# 清除上下文
curl -X DELETE http://localhost:8083/api/v1/context/session-1
```

Expected: 各操作返回正确结果

- [ ] **Step 12.8: 手动测试 — Billing**

```bash
curl http://localhost:8083/api/v1/billing/summary/default
```

Expected: 200 OK，返回使用量汇总

- [ ] **Step 12.9: 打包**

```bash
./mvnw clean package -DskipTests
```

Expected: JAR 文件生成

- [ ] **Step 12.10: Docker 打包**

创建 `Dockerfile`：

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
```

```bash
docker build -t metaplatform/ai-substrate:0.1.0 .
```

- [ ] **Step 12.11: 最终提交**

```bash
git add .
git commit -m "chore: add Dockerfile and finalize AI substrate v0.1"
```

---

## 验收标准

| # | 验收项 | 验证方法 |
|---|--------|----------|
| 1 | LLM Gateway 双适配器 | OpenAI + Anthropic 模型均可调用 |
| 2 | 模型别名路由 | "fast" -> gpt-3.5-turbo，"smart" -> gpt-4o |
| 3 | Embedding 服务 | ada-002 嵌入生成 + Redis 缓存 |
| 4 | Context Store | Redis 滑动窗口 + 24h TTL |
| 5 | In-Memory Vector Store | 余弦相似度搜索 + 过滤 |
| 6 | Agent Runtime | 单步 tool calling |
| 7 | Token Billing | 内存计数器 + 每日配额 |
| 8 | 全部 REST API | 5 个端点均可访问 |
| 9 | 全部单元测试通过 | `./mvnw test` |
| 10 | 应用可启动 | `./mvnw spring-boot:run` |
| 11 | Docker 镜像可构建 | `docker build` |
