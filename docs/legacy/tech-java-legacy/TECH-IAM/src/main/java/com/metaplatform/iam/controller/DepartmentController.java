package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.department.CreateDepartmentRequest;
import com.metaplatform.iam.dto.department.DepartmentResponse;
import com.metaplatform.iam.dto.department.UpdateDepartmentRequest;
import com.metaplatform.iam.service.DepartmentService;
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

@RestController
@RequestMapping("/api/v1/iam/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentService departmentService;

    @PostMapping
    public ApiResponse<DepartmentResponse> create(@Valid @RequestBody CreateDepartmentRequest request) {
        return ApiResponse.success(departmentService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<DepartmentResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String parentId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(departmentService.list(tenantId, parentId, keyword, page, size));
    }

    @GetMapping("/tree")
    public ApiResponse<List<DepartmentResponse>> tree(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String rootId) {
        return ApiResponse.success(departmentService.tree(tenantId, rootId));
    }

    @GetMapping("/{id}")
    public ApiResponse<DepartmentResponse> get(@PathVariable String id) {
        return ApiResponse.success(departmentService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DepartmentResponse> update(@PathVariable String id,
                                                   @Valid @RequestBody UpdateDepartmentRequest request) {
        return ApiResponse.success(departmentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        departmentService.softDelete(id);
        return ApiResponse.success();
    }
}