package com.metaplatform.gw.api.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.gw.api.dto.ApiListItem;
import com.metaplatform.gw.api.dto.ApiResponse;
import com.metaplatform.gw.api.dto.CreateApiRequest;
import com.metaplatform.gw.api.dto.UpdateApiRequest;
import com.metaplatform.gw.api.service.ApiService;
import com.metaplatform.gw.api.service.OpenApiExportService;
import com.metaplatform.gw.common.ApiResponseBody;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/gw/apis")
@RequiredArgsConstructor
@Slf4j
public class ApiController {

    private final ApiService apiService;
    private final OpenApiExportService openApiExportService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping
    public Mono<ResponseEntity<ApiResponseBody<ApiResponse>>> createApi(@Valid @RequestBody CreateApiRequest request) {
        return apiService.createApi(request)
                .map(r -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponseBody.success(r)))
                .onErrorResume(ApiService.ApiException.class, this::toErrorResponse);
    }

    @GetMapping
    public Mono<ApiResponseBody<PageResponse<ApiListItem>>> listApis(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String groupName,
            @RequestParam(required = false) String version,
            @RequestParam(required = false) String keyword) {
        return apiService.listApis(page, size, tenantId, groupName, version, keyword)
                .map(ApiResponseBody::success)
                .onErrorResume(ApiService.ApiException.class, e -> Mono.just(ApiResponseBody.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/by-group/{groupName}")
    public Mono<ApiResponseBody<PageResponse<ApiListItem>>> listByGroup(
            @PathVariable String groupName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId) {
        return apiService.listByGroup(groupName, page, size, tenantId)
                .map(ApiResponseBody::success)
                .onErrorResume(ApiService.ApiException.class, e -> Mono.just(ApiResponseBody.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<ApiResponse>>> getApi(@PathVariable UUID id) {
        return apiService.getApi(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(ApiService.ApiException.class, this::toErrorResponse);
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<ApiResponse>>> updateApi(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateApiRequest request) {
        return apiService.updateApi(id, request)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(ApiService.ApiException.class, this::toErrorResponse);
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<Void>>> deleteApi(@PathVariable UUID id) {
        return apiService.deleteApi(id)
                .then(Mono.just(ResponseEntity.ok(ApiResponseBody.<Void>success())))
                .onErrorResume(ApiService.ApiException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponseBody.<Void>error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @GetMapping("/{id}/openapi")
    public Mono<ResponseEntity<String>> exportOpenApi(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "json") String format) {
        Mono<String> body;
        MediaType contentType;
        if ("yaml".equalsIgnoreCase(format) || "yml".equalsIgnoreCase(format)) {
            body = openApiExportService.exportOpenApiYaml(id);
            contentType = MediaType.valueOf("application/yaml");
        } else {
            body = openApiExportService.exportOpenApiJson(id)
                    .map(spec -> {
                        try {
                            return objectMapper.writeValueAsString(spec);
                        } catch (JsonProcessingException e) {
                            throw new RuntimeException(e);
                        }
                    });
            contentType = MediaType.APPLICATION_JSON;
        }

        return body
                .map(b -> ResponseEntity.ok().contentType(contentType).body(b))
                .onErrorResume(ApiService.ApiException.class, e ->
                        Mono.just(ResponseEntity.status(e.getErrorCode().getHttpStatus())
                                .body("{\"code\":" + e.getErrorCode().getCode() +
                                        ",\"message\":\"" + e.getErrorCode().getMessage() + "\"}")));
    }

    @GetMapping("/groups/{groupName}/openapi")
    public Mono<ResponseEntity<String>> exportOpenApiForGroup(
            @PathVariable String groupName,
            @RequestParam(required = false) String tenantId) {
        return openApiExportService.exportOpenApiForGroup(groupName, tenantId)
                .map(spec -> {
                    try {
                        return objectMapper.writeValueAsString(spec);
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException(e);
                    }
                })
                .map(b -> ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(b));
    }

    @ExceptionHandler(ApiService.ApiException.class)
    public Mono<ResponseEntity<ApiResponseBody<Void>>> handleApiException(ApiService.ApiException e) {
        ErrorCode errorCode = e.getErrorCode();
        return Mono.just(ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponseBody.<Void>error(errorCode.getCode(), errorCode.getMessage())));
    }

    private <T> Mono<ResponseEntity<ApiResponseBody<T>>> toErrorResponse(ApiService.ApiException e) {
        return Mono.just(ResponseEntity.status(e.getErrorCode().getHttpStatus())
                .body(ApiResponseBody.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }
}
