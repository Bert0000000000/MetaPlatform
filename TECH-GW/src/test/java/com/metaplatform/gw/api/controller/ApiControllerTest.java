package com.metaplatform.gw.api.controller;

import com.metaplatform.gw.api.dto.ApiListItem;
import com.metaplatform.gw.api.dto.ApiResponse;
import com.metaplatform.gw.api.dto.CreateApiRequest;
import com.metaplatform.gw.api.dto.UpdateApiRequest;
import com.metaplatform.gw.api.service.ApiService;
import com.metaplatform.gw.api.service.OpenApiExportService;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;

@WebFluxTest(controllers = ApiController.class)
class ApiControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private ApiService apiService;

    @MockBean
    private OpenApiExportService openApiExportService;

    private ApiResponse buildResponse(UUID id) {
        return ApiResponse.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("Test")
                .path("/api/v1/test")
                .method("GET")
                .groupName("default")
                .version("v1")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private ApiListItem buildListItem() {
        return ApiListItem.builder()
                .id(UUID.randomUUID().toString())
                .name("Test")
                .path("/api/v1/test")
                .method("GET")
                .groupName("default")
                .version("v1")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now().toString())
                .updatedAt(LocalDateTime.now().toString())
                .build();
    }

    @Test
    void createApi_shouldReturn201() {
        when(apiService.createApi(any(CreateApiRequest.class)))
                .thenReturn(Mono.just(buildResponse(UUID.randomUUID())));

        CreateApiRequest request = CreateApiRequest.builder()
                .name("Test")
                .path("/api/v1/test")
                .method("GET")
                .build();

        webTestClient.post()
                .uri("/api/v1/gw/apis")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.name").isEqualTo("Test")
                .jsonPath("$.data.method").isEqualTo("GET");
    }

    @Test
    void listApis_shouldReturnPage() {
        PageResponse<ApiListItem> page = PageResponse.<ApiListItem>builder()
                .items(List.of(buildListItem()))
                .total(1)
                .page(1)
                .size(20)
                .totalPages(1)
                .build();

        when(apiService.listApis(anyInt(), anyInt(), nullable(String.class),
                nullable(String.class), nullable(String.class), nullable(String.class)))
                .thenReturn(Mono.just(page));

        webTestClient.get()
                .uri("/api/v1/gw/apis")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.total").isEqualTo(1);
    }

    @Test
    void getApi_shouldReturnDetail() {
        UUID id = UUID.randomUUID();
        when(apiService.getApi(id)).thenReturn(Mono.just(buildResponse(id)));

        webTestClient.get()
                .uri("/api/v1/gw/apis/" + id)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.id").isEqualTo(id.toString());
    }

    @Test
    void updateApi_shouldReturnUpdated() {
        UUID id = UUID.randomUUID();
        ApiResponse response = buildResponse(id);
        response.setName("Updated");
        when(apiService.updateApi(any(UUID.class), any(UpdateApiRequest.class)))
                .thenReturn(Mono.just(response));

        UpdateApiRequest request = UpdateApiRequest.builder().name("Updated").build();

        webTestClient.put()
                .uri("/api/v1/gw/apis/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.name").isEqualTo("Updated");
    }

    @Test
    void deleteApi_shouldReturnSuccess() {
        UUID id = UUID.randomUUID();
        when(apiService.deleteApi(id)).thenReturn(Mono.empty());

        webTestClient.delete()
                .uri("/api/v1/gw/apis/" + id)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0);
    }

    @Test
    void getApi_shouldReturn404WhenNotFound() {
        UUID id = UUID.randomUUID();
        when(apiService.getApi(id)).thenReturn(Mono.error(new ApiService.ApiException(ErrorCode.NOT_FOUND)));

        webTestClient.get()
                .uri("/api/v1/gw/apis/" + id)
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.code").isEqualTo(40401);
    }

    @Test
    void exportOpenApi_jsonFormat() {
        UUID id = UUID.randomUUID();
        when(openApiExportService.exportOpenApiJson(id))
                .thenReturn(Mono.just(Map.of("openapi", "3.0.3", "info", Map.of("title", "test"))));

        webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/gw/apis/" + id + "/openapi")
                        .queryParam("format", "json").build())
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentType(MediaType.APPLICATION_JSON)
                .expectBody()
                .jsonPath("$.openapi").isEqualTo("3.0.3");
    }
}
