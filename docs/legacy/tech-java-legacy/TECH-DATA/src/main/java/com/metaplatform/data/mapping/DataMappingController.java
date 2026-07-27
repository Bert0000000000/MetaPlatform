package com.metaplatform.data.mapping;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.mapping.dto.AutoDiscoverRequest;
import com.metaplatform.data.mapping.dto.AutoDiscoverResponse;
import com.metaplatform.data.mapping.dto.CreateDataMappingRequest;
import com.metaplatform.data.mapping.dto.CreateMappingFieldRequest;
import com.metaplatform.data.mapping.dto.DataMappingResponse;
import com.metaplatform.data.mapping.dto.MappingExecutionResponse;
import com.metaplatform.data.mapping.dto.MappingFieldResponse;
import com.metaplatform.data.mapping.dto.MappingValidationResult;
import com.metaplatform.data.mapping.dto.UpdateDataMappingRequest;
import com.metaplatform.data.mapping.dto.UpdateMappingFieldRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 数据映射端点 — 外部数据源字段 → Ontology 实体属性映射（PRD REQ-3.2.2）。
 *
 * <p>路径：{@code /api/v1/data/mappings}</p>
 */
@RestController
@RequestMapping("/api/v1/data/mappings")
@RequiredArgsConstructor
public class DataMappingController {

    private final DataMappingService dataMappingService;

    // =====================================================================
    // 映射 CRUD
    // =====================================================================

    @GetMapping
    public ApiResponse<PageResponse<DataMappingResponse>> list(
            @RequestParam(required = false) String datasourceId,
            @RequestParam(required = false) String ontologyEntityId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(dataMappingService.list(datasourceId, ontologyEntityId, status, page, pageSize));
    }

    @PostMapping
    public ApiResponse<DataMappingResponse> create(@Valid @RequestBody CreateDataMappingRequest request) {
        return ApiResponse.success(dataMappingService.create(request));
    }

    @GetMapping("/{mappingId}")
    public ApiResponse<DataMappingResponse> get(@PathVariable String mappingId) {
        return ApiResponse.success(dataMappingService.get(mappingId));
    }

    @PutMapping("/{mappingId}")
    public ApiResponse<DataMappingResponse> update(
            @PathVariable String mappingId,
            @Valid @RequestBody UpdateDataMappingRequest request) {
        return ApiResponse.success(dataMappingService.update(mappingId, request));
    }

    @DeleteMapping("/{mappingId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String mappingId) {
        boolean ok = dataMappingService.delete(mappingId);
        return ApiResponse.success(Map.of("deleted", ok, "mappingId", mappingId));
    }

    // =====================================================================
    // 字段映射管理
    // =====================================================================

    @GetMapping("/{mappingId}/fields")
    public ApiResponse<List<MappingFieldResponse>> listFields(@PathVariable String mappingId) {
        return ApiResponse.success(dataMappingService.listFields(mappingId));
    }

    @PostMapping("/{mappingId}/fields")
    public ApiResponse<MappingFieldResponse> addField(
            @PathVariable String mappingId,
            @Valid @RequestBody CreateMappingFieldRequest request) {
        return ApiResponse.success(dataMappingService.addField(mappingId, request));
    }

    @PutMapping("/{mappingId}/fields/{fieldId}")
    public ApiResponse<MappingFieldResponse> updateField(
            @PathVariable String mappingId,
            @PathVariable String fieldId,
            @Valid @RequestBody UpdateMappingFieldRequest request) {
        return ApiResponse.success(dataMappingService.updateField(mappingId, fieldId, request));
    }

    @DeleteMapping("/{mappingId}/fields/{fieldId}")
    public ApiResponse<Map<String, Object>> deleteField(
            @PathVariable String mappingId,
            @PathVariable String fieldId) {
        boolean ok = dataMappingService.deleteField(mappingId, fieldId);
        return ApiResponse.success(Map.of("deleted", ok, "fieldId", fieldId));
    }

    // =====================================================================
    // 映射执行
    // =====================================================================

    @PostMapping("/{mappingId}/execute")
    public ApiResponse<MappingExecutionResponse> execute(@PathVariable String mappingId) {
        return ApiResponse.success(dataMappingService.execute(mappingId));
    }

    @GetMapping("/{mappingId}/executions")
    public ApiResponse<PageResponse<MappingExecutionResponse>> listExecutions(
            @PathVariable String mappingId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(dataMappingService.listExecutions(mappingId, page, pageSize));
    }

    @PostMapping("/{mappingId}/validate")
    public ApiResponse<MappingValidationResult> validate(@PathVariable String mappingId) {
        return ApiResponse.success(dataMappingService.validate(mappingId));
    }

    // =====================================================================
    // 自动发现
    // =====================================================================

    @PostMapping("/auto-discover")
    public ApiResponse<AutoDiscoverResponse> autoDiscover(@Valid @RequestBody AutoDiscoverRequest request) {
        return ApiResponse.success(dataMappingService.autoDiscover(request));
    }
}
