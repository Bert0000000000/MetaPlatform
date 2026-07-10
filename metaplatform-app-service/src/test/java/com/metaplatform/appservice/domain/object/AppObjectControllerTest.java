package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.app.AppEntity;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AppObjectControllerTest {

    @LocalServerPort int port;
    @Autowired AppRepository appRepository;
    @Autowired AppObjectRepository objectRepository;

    Long appId;

    @BeforeEach
    void setup() {
        AppEntity app = new AppEntity();
        app.setTenantId("test-tenant");
        app.setCode("travel");
        app.setName("差旅");
        app.setCreatedBy("dev-user");
        app.setIcon("airplane");
        app = appRepository.save(app);
        appId = app.getId();
    }

    @AfterEach
    void tearDown() {
        appRepository.deleteAll();
        objectRepository.deleteAll();
    }

    @Test
    void shouldCreateObjectAndLinkOntology() {
        RestClient client = RestClient.create("http://localhost:" + port);

        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> created =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps/" + appId + "/objects")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "code", "reimbursement",
                    "name", "报销单",
                    "description", "差旅类报销",
                    "fields", List.of(
                        Map.of("code", "from_city", "name", "出发地", "type", "string", "required", true),
                        Map.of("code", "amount", "name", "金额", "type", "number", "required", true),
                        Map.of("code", "is_paid", "name", "已支付", "type", "boolean", "required", false)
                    )
                ))
                .retrieve()
                .body(ApiResponse.class);
        assertEquals(0, created.code());
        Map<String, Object> data = created.data();
        assertNotNull(data.get("id"));
        assertTrue(((String) data.get("dataTableName")).startsWith("data_reimbursement_"));
        assertNotNull(data.get("ontologyObjectId"));
    }

    @Test
    void shouldRejectDuplicateObjectCode() {
        RestClient client = RestClient.create("http://localhost:" + port);

        client.post().uri("/api/apps/" + appId + "/objects")
            .header("X-Tenant-Id", "test-tenant")
            .body(Map.of(
                "code", "reimbursement",
                "name", "报销单",
                "fields", List.of(Map.of("code", "amount", "name", "金额", "type", "number"))
            ))
            .retrieve().body(ApiResponse.class);

        try {
            client.post().uri("/api/apps/" + appId + "/objects")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "code", "reimbursement",
                    "name", "报销单2",
                    "fields", List.of(Map.of("code", "amount", "name", "金额", "type", "number"))
                ))
                .retrieve().toBodilessEntity();
            fail("应 409");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("409"));
        }
    }

    @Test
    void shouldRejectUnknownFieldType() {
        RestClient client = RestClient.create("http://localhost:" + port);

        try {
            client.post().uri("/api/apps/" + appId + "/objects")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "code", "reimbursement",
                    "name", "报销单",
                    "fields", List.of(Map.of("code", "amount", "name", "金额", "type", "binary"))
                ))
                .retrieve().toBodilessEntity();
            fail("应 400");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("400"));
        }
    }

    @Test
    void shouldNotAllowChangingFields() {
        RestClient client = RestClient.create("http://localhost:" + port);

        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> created =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps/" + appId + "/objects")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "code", "reimbursement",
                    "name", "报销单",
                    "fields", List.of(Map.of("code", "amount", "name", "金额", "type", "number"))
                ))
                .retrieve().body(ApiResponse.class);
        Number oid = (Number) created.data().get("id");

        try {
            client.put().uri("/api/apps/" + appId + "/objects/" + oid)
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "fields", List.of(Map.of("code", "new_field", "name", "新字段", "type", "string"))
                ))
                .retrieve().toBodilessEntity();
            fail("应 400");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("400"));
        }
    }
}
