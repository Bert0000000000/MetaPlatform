package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.api.page.PageParams;
import com.metaplatform.appservice.api.page.PageResult;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 对象元数据 HTTP 端点.
 *
 * <p>AC-103.6 ETag 乐观锁协议:
 * <ul>
 *   <li>GET 响应头 {@code ETag: "v<N>"} 携带当前 version.</li>
 *   <li>PUT 请求头 {@code If-Match: "v<N>"} 携带期望 version,
 *       不匹配时返回 {@code 412 Precondition Failed}.</li>
 *   <li>PUT 请求体可省略 {@code If-Match}, 兼容旧调用方.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/apps/{appId}/objects")
public class AppObjectController {

    /** ETag 包装格式: 强校验, 双引号包裹. */
    private static String etag(Integer version) {
        return "\"" + (version == null ? "0" : version) + "\"";
    }

    /** 解析 If-Match: 支持 "v3" / "\"3\"" / "3" 三种格式. */
    private static Integer parseIfMatch(String header) {
        if (header == null) return null;
        String trimmed = header.trim();
        if (trimmed.startsWith("v") || trimmed.startsWith("V")) {
            trimmed = trimmed.substring(1);
        }
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() >= 2) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        try {
            return Integer.parseInt(trimmed);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private final AppObjectService service;

    public AppObjectController(AppObjectService service) {
        this.service = service;
    }

    /**
     * 列出应用下的对象.
     *
     * <p>v1.0.2 B1.1 起支持分页:
     * <ul>
     *   <li>不传 {@code page}/{@code size} → 返回完整列表 (v1.0.1 向后兼容)</li>
     *   <li>传任意一个 → 返回 {@link PageResult} 包装</li>
     *   <li>都传 → 返回分页结果</li>
     * </ul>
     */
    @GetMapping
    public ApiResponse<?> list(
            @PathVariable String appId,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size) {
        if (page == null && size == null) {
            // 向后兼容: 不带分页参数时, 返回 v1.0.1 风格的纯列表
            return ApiResponse.ok(service.list(appId), MDC.get("traceId"));
        }
        PageParams params = new PageParams(page, size);
        PageResult<AppObjectEntity> result = service.listPaged(appId, params);
        return ApiResponse.ok(result, MDC.get("traceId"));
    }

    @GetMapping("/{oid}")
    public ResponseEntity<ApiResponse<AppObjectEntity>> get(@PathVariable String appId,
                                                            @PathVariable Long oid) {
        AppObjectEntity entity = service.get(appId, oid);
        ApiResponse<AppObjectEntity> body = ApiResponse.ok(entity, MDC.get("traceId"));
        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, etag(entity.getVersion()))
                .body(body);
    }

    @PostMapping
    public ApiResponse<AppObjectEntity> create(@PathVariable String appId,
                                               @RequestBody AppObjectService.AppObjectCreateRequest req) {
        return ApiResponse.ok(service.create(appId, req), MDC.get("traceId"));
    }

    @PutMapping("/{oid}")
    public ResponseEntity<ApiResponse<AppObjectEntity>> update(
            @PathVariable String appId,
            @PathVariable Long oid,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody AppObjectService.AppObjectUpdateRequest req) {
        Integer expectedVersion = parseIfMatch(ifMatch);
        AppObjectEntity updated = service.update(appId, oid, req, expectedVersion);
        ApiResponse<AppObjectEntity> body = ApiResponse.ok(updated, MDC.get("traceId"));
        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, etag(updated.getVersion()))
                .body(body);
    }

    @DeleteMapping("/{oid}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String appId,
                                                   @PathVariable Long oid) {
        service.delete(appId, oid);
        return ApiResponse.ok(Map.of("deleted", true), MDC.get("traceId"));
    }
}