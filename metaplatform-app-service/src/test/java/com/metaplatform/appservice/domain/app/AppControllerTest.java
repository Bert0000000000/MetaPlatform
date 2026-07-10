package com.metaplatform.appservice.domain.app;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 应用 CRUD 集成测试（H2 内存数据库 + Flyway 迁移）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AppControllerTest {

    @LocalServerPort int port;
    @Autowired AppRepository appRepository;

    @BeforeEach
    void setup() {
        TenantContext.set("test-tenant");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        appRepository.deleteAll();
    }

    @Test
    void shouldCreateListGetUpdateArchiveApp() {
        RestClient client = RestClient.create("http://localhost:" + port);

        // 创建应用
        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> created =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps")
                .body(Map.of("code", "travel", "name", "差旅报销", "icon", "airplane"))
                .header("X-Tenant-Id", "test-tenant")
                .retrieve()
                .body(ApiResponse.class);
        assertNotNull(created);
        assertEquals(0, created.code());
        Map<String, Object> data = created.data();
        Number id = (Number) data.get("id");
        assertNotNull(id);
        assertEquals(1, ((Number) data.get("version")).intValue());

        // 列表
        @SuppressWarnings("unchecked")
        ApiResponse<List<Map<String, Object>>> list =
            (ApiResponse<List<Map<String, Object>>>)(Object) client.get()
                .uri("/api/apps")
                .header("X-Tenant-Id", "test-tenant")
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, list.code());
        assertEquals(1, list.data().size());

        // 详情
        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> got =
            (ApiResponse<Map<String, Object>>) (Object) client.get()
                .uri("/api/apps/" + id)
                .header("X-Tenant-Id", "test-tenant")
                .retrieve()
                .body(ApiResponse.class);
        assertEquals("差旅报销", got.data().get("name"));

        // 更新（带 version 乐观锁）
        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> updated =
            (ApiResponse<Map<String, Object>>) (Object) client.put()
                .uri("/api/apps/" + id)
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "version", 1,
                    "name", "差旅报销 v2",
                    "icon", "airplane",
                    "description", "差旅类报销"
                ))
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, updated.code());
        assertEquals(2, ((Number) updated.data().get("version")).intValue());

        // 乐观锁：再次用 version=1 触发冲突
        try {
            client.put()
                .uri("/api/apps/" + id)
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of("version", 1, "name", "失配"))
                .retrieve()
                .toBodilessEntity();
            fail("应该抛 409");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("409"));
        }

        // 软删
        @SuppressWarnings("unchecked")
        ApiResponse<Object> deleted =
            (ApiResponse<Object>) (Object) client.delete()
                .uri("/api/apps/" + id)
                .header("X-Tenant-Id", "test-tenant")
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, deleted.code());

        // 软删后再列表应为空
        @SuppressWarnings("unchecked")
        ApiResponse<List<Map<String, Object>>> afterList =
            (ApiResponse<List<Map<String, Object>>>)(Object) client.get()
                .uri("/api/apps")
                .header("X-Tenant-Id", "test-tenant")
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, afterList.data().size());
    }

    @Test
    void shouldRejectDuplicateCode() {
        RestClient client = RestClient.create("http://localhost:" + port);
        String code = "demo_" + java.util.UUID.randomUUID().toString().substring(0, 8);

        client.post().uri("/api/apps")
            .header("X-Tenant-Id", "test-tenant")
            .body(Map.of("code", code, "name", "Demo 1"))
            .retrieve().body(ApiResponse.class);

        try {
            client.post().uri("/api/apps")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of("code", code, "name", "Demo 2"))
                .retrieve().toBodilessEntity();
            fail("应该 409");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("409"));
        }
    }

    @Test
    void shouldRejectInvalidCode() {
        RestClient client = RestClient.create("http://localhost:" + port);

        try {
            client.post().uri("/api/apps")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of("code", "1bad", "name", "Bad code"))
                .retrieve().toBodilessEntity();
            fail("应该 400");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("400"));
        }
    }

    @Test
    void shouldIsolateCrossTenant() {
        RestClient client = RestClient.create("http://localhost:" + port);

        client.post().uri("/api/apps")
            .header("X-Tenant-Id", "tenant-A")
            .body(Map.of("code", "travel", "name", "Travel A"))
            .retrieve().body(ApiResponse.class);

        // tenant-B 看不到，应为空
        @SuppressWarnings("unchecked")
        ApiResponse<List<Map<String, Object>>> list =
            (ApiResponse<List<Map<String, Object>>>)(Object) client.get()
                .uri("/api/apps")
                .header("X-Tenant-Id", "tenant-B")
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, list.data().size());

        // tenant-B 跨租户访问不存在，应 404
        try {
            client.get().uri("/api/apps/1")
                .header("X-Tenant-Id", "tenant-B")
                .retrieve().toBodilessEntity();
            fail("应该 404");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("404"));
        }
    }
}
