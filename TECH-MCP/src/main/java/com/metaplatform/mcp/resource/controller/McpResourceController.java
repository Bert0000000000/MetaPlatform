package com.metaplatform.mcp.resource.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.resource.dto.CreateResourceRequest;
import com.metaplatform.mcp.resource.dto.ResourceListItem;
import com.metaplatform.mcp.resource.dto.ResourceResponse;
import com.metaplatform.mcp.resource.dto.UpdateResourceRequest;
import com.metaplatform.mcp.resource.service.McpResourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/resources")
@RequiredArgsConstructor
public class McpResourceController {

    private final McpResourceService resourceService;

    @PostMapping
    public ApiResponse<ResourceResponse> create(@Valid @RequestBody CreateResourceRequest request) {
        return ApiResponse.success(resourceService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ResourceListItem>> list(
            @RequestParam(required = false) String conceptId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(resourceService.list(conceptId, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ResourceResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(resourceService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ResourceResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateResourceRequest request) {
        return ApiResponse.success(resourceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        resourceService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/content")
    public ApiResponse<Map<String, Object>> readContent(@PathVariable UUID id) {
        String content = resourceService.readContent(id);
        return ApiResponse.success(Map.of("id", id, "content", content == null ? "" : content));
    }

    @GetMapping("/by-concept/{conceptId}")
    public ApiResponse<List<ResourceListItem>> findByConcept(@PathVariable String conceptId) {
        return ApiResponse.success(resourceService.findByConcept(conceptId));
    }
}