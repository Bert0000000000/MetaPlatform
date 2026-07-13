package com.metaplatform.appservice.domain.object;

import com.metaplatform.appservice.api.error.ApiResponse;
import jakarta.validation.Valid;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 对象字段管理 —— 独立于 {@link AppObjectController} 的细粒度字段 CRUD.
 *
 * <p>字段元数据存储在 app_objects.schema_json 中；物理数据表在首次添加字段时创建，
 * 后续新增字段通过 ALTER TABLE 追加列.
 *
 * <p>AC-103.6: 字段级增删改也支持 {@code If-Match} 乐观锁,
 * 保证字段修改与对象整体版本号一致.
 */
@RestController
@RequestMapping("/api/apps/{appId}/objects/{oid}/fields")
public class AppObjectFieldController {

    private static Integer parseIfMatch(String header) {
        if (header == null) return null;
        String trimmed = header.trim();
        if (trimmed.startsWith("v") || trimmed.startsWith("V")) trimmed = trimmed.substring(1);
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() >= 2) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        try { return Integer.parseInt(trimmed); } catch (NumberFormatException ignored) { return null; }
    }

    private final AppObjectFieldService fieldService;

    public AppObjectFieldController(AppObjectFieldService fieldService) {
        this.fieldService = fieldService;
    }

    @GetMapping
    public ApiResponse<List<AppObjectFieldService.FieldView>> list(
            @PathVariable String appId,
            @PathVariable Long oid) {
        return ApiResponse.ok(fieldService.list(appId, oid), MDC.get("traceId"));
    }

    @PostMapping
    public ApiResponse<List<AppObjectFieldService.FieldView>> add(
            @PathVariable String appId,
            @PathVariable Long oid,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @Valid @RequestBody AppObjectFieldService.FieldRequest req) {
        return ApiResponse.ok(fieldService.add(appId, oid, req, parseIfMatch(ifMatch)), MDC.get("traceId"));
    }

    @PutMapping("/{code}")
    public ApiResponse<List<AppObjectFieldService.FieldView>> update(
            @PathVariable String appId,
            @PathVariable Long oid,
            @PathVariable String code,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @Valid @RequestBody AppObjectFieldService.FieldRequest req) {
        return ApiResponse.ok(fieldService.update(appId, oid, code, req, parseIfMatch(ifMatch)), MDC.get("traceId"));
    }

    @DeleteMapping("/{code}")
    public ApiResponse<List<AppObjectFieldService.FieldView>> delete(
            @PathVariable String appId,
            @PathVariable Long oid,
            @PathVariable String code,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
        return ApiResponse.ok(fieldService.delete(appId, oid, code, parseIfMatch(ifMatch)), MDC.get("traceId"));
    }
}