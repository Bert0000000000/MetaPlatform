package com.metaplatform.appservice.domain.form;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppEntity;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
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
class AppFormControllerTest {

    @LocalServerPort int port;
    @Autowired AppRepository appRepository;
    @Autowired AppObjectRepository objectRepository;
    @Autowired AppFormRepository formRepository;

    Long appId;
    Long objectId;

    @BeforeEach
    void setup() {
        AppEntity app = new AppEntity();
        app.setTenantId("test-tenant");
        app.setCode("travel");
        app.setName("差旅");
        app.setCreatedBy("dev-user");
        app = appRepository.save(app);
        appId = app.getId();

        AppObjectEntity object = new AppObjectEntity();
        object.setAppId(appId);
        object.setCode("reimbursement");
        object.setName("报销单");
        object.setSchemaJson("[]");
        object.setDataTableName("data_demo_dummy");
        object.setOntologyObjectId("ot-test");
        object.setCreatedBy("dev-user");
        object = objectRepository.save(object);
        objectId = object.getId();
    }

    @AfterEach
    void tearDown() {
        appRepository.deleteAll();
        objectRepository.deleteAll();
        formRepository.deleteAll();
    }

    @Test
    void shouldCreatePublishForm() {
        RestClient client = RestClient.create("http://localhost:" + port);

        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> created =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps/" + appId + "/forms")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "objectId", objectId,
                    "code", "create_form",
                    "name", "新建报销",
                    "schema", "[{\"from_city\":\"text\"}]"
                ))
                .retrieve().body(ApiResponse.class);
        assertEquals(0, created.code());
        assertEquals("draft", created.data().get("status"));
        Number fid = (Number) created.data().get("id");

        // 发布
        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> published =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps/" + appId + "/forms/" + fid + "/publish")
                .header("X-Tenant-Id", "test-tenant")
                .retrieve().body(ApiResponse.class);
        assertEquals("published", published.data().get("status"));
        assertEquals(2, ((Number) published.data().get("version")).intValue());
    }

    @Test
    void shouldRejectDuplicateFormCode() {
        RestClient client = RestClient.create("http://localhost:" + port);

        client.post().uri("/api/apps/" + appId + "/forms")
            .header("X-Tenant-Id", "test-tenant")
            .body(Map.of(
                "objectId", objectId,
                "code", "create_form",
                "name", "新建报销",
                "schema", "{}"
            ))
            .retrieve().body(ApiResponse.class);

        try {
            client.post().uri("/api/apps/" + appId + "/forms")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "objectId", objectId,
                    "code", "create_form",
                    "name", "新建报销 2",
                    "schema", "{}"
                ))
                .retrieve().toBodilessEntity();
            fail("应 409");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("409"));
        }
    }

    @Test
    void shouldRejectPublishedFormEdit() {
        RestClient client = RestClient.create("http://localhost:" + port);

        @SuppressWarnings("unchecked")
        ApiResponse<Map<String, Object>> created =
            (ApiResponse<Map<String, Object>>) (Object) client.post()
                .uri("/api/apps/" + appId + "/forms")
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of(
                    "objectId", objectId,
                    "code", "draft_form",
                    "name", "草稿表",
                    "schema", "{}"
                ))
                .retrieve().body(ApiResponse.class);
        Number fid = (Number) created.data().get("id");

        // 发布
        client.post().uri("/api/apps/" + appId + "/forms/" + fid + "/publish")
            .header("X-Tenant-Id", "test-tenant")
            .retrieve().toBodilessEntity();

        // 试图修改已发布
        try {
            client.put().uri("/api/apps/" + appId + "/forms/" + fid)
                .header("X-Tenant-Id", "test-tenant")
                .body(Map.of("name", "改名"))
                .retrieve().toBodilessEntity();
            fail("应 400");
        } catch (Exception e) {
            assertTrue(e.getMessage().contains("400"));
        }
    }
}
