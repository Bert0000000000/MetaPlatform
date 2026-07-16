package com.metaplatform.gw.route.controller;

import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.route.dto.CreateRouteRequest;
import com.metaplatform.gw.route.dto.RouteResponse;
import com.metaplatform.gw.route.dto.UpdateRouteRequest;
import com.metaplatform.gw.route.service.GwRouteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@WebFluxTest(controllers = GwRouteController.class)
class GwRouteControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private GwRouteService routeService;

    @MockBean
    private ApplicationEventPublisher eventPublisher;

    private RouteResponse buildResponse(String id, String routeId) {
        return RouteResponse.builder()
                .id(id)
                .tenantId("tenant-default")
                .routeId(routeId)
                .name("Test Route")
                .uri("http://localhost:9000")
                .predicates(List.of(Map.of("name", "Path", "args", Map.of("_genkey_0", "/api/v1/test/**"))))
                .filters(List.of())
                .priority(0)
                .enabled(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void createRoute_shouldReturn201() {
        RouteResponse response = buildResponse("route-1", "test-route");
        when(routeService.createRoute(any(CreateRouteRequest.class)))
                .thenReturn(Mono.just(response));

        CreateRouteRequest request = CreateRouteRequest.builder()
                .routeId("test-route")
                .uri("http://localhost:9000")
                .predicates(List.of(CreateRouteRequest.PredicateDto.builder()
                        .name("Path")
                        .args(Map.of("_genkey_0", "/api/v1/test/**"))
                        .build()))
                .build();

        webTestClient.post()
                .uri("/api/v1/gw/routes")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.routeId").isEqualTo("test-route")
                .jsonPath("$.data.uri").isEqualTo("http://localhost:9000");
    }

    @Test
    void listRoutes_shouldReturnPage() {
        RouteResponse response = buildResponse("route-1", "test-route");
        PageResponse<RouteResponse> pageResponse = PageResponse.<RouteResponse>builder()
                .items(List.of(response))
                .total(1)
                .page(0)
                .size(20)
                .totalPages(1)
                .build();

        when(routeService.listRoutes(anyInt(), anyInt(), nullable(String.class)))
                .thenReturn(Mono.just(pageResponse));

        webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/gw/routes")
                        .queryParam("page", 0)
                        .queryParam("size", 20)
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.items[0].routeId").isEqualTo("test-route")
                .jsonPath("$.data.total").isEqualTo(1);
    }

    @Test
    void getRoute_shouldReturnDetail() {
        RouteResponse response = buildResponse("route-1", "test-route");
        when(routeService.getRoute("route-1"))
                .thenReturn(Mono.just(response));

        webTestClient.get()
                .uri("/api/v1/gw/routes/route-1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.id").isEqualTo("route-1")
                .jsonPath("$.data.routeId").isEqualTo("test-route");
    }

    @Test
    void getRoute_shouldReturn404WhenNotFound() {
        when(routeService.getRoute("non-existent"))
                .thenReturn(Mono.error(new GwRouteService.RouteException(
                        com.metaplatform.gw.common.ErrorCode.ROUTE_NOT_FOUND)));

        webTestClient.get()
                .uri("/api/v1/gw/routes/non-existent")
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.code").isEqualTo(40402)
                .jsonPath("$.message").isEqualTo("路由不存在");
    }

    @Test
    void updateRoute_shouldReturnUpdated() {
        RouteResponse response = buildResponse("route-1", "test-route-updated");
        response.setName("Updated Route");
        when(routeService.updateRoute(anyString(), any(UpdateRouteRequest.class)))
                .thenReturn(Mono.just(response));

        UpdateRouteRequest request = UpdateRouteRequest.builder()
                .name("Updated Route")
                .build();

        webTestClient.put()
                .uri("/api/v1/gw/routes/route-1")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.name").isEqualTo("Updated Route");
    }

    @Test
    void deleteRoute_shouldReturnSuccess() {
        when(routeService.deleteRoute("route-1"))
                .thenReturn(Mono.empty());

        webTestClient.delete()
                .uri("/api/v1/gw/routes/route-1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0);
    }

    @Test
    void refreshRoutes_shouldReturnSuccess() {
        when(routeService.refreshRoutes())
                .thenReturn(Mono.empty());

        webTestClient.post()
                .uri("/api/v1/gw/routes/route-1/refresh")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0);

        verify(routeService).refreshRoutes();
    }
}
