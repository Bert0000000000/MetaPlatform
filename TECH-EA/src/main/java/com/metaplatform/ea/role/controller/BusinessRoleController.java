package com.metaplatform.ea.role.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.role.dto.CreateRoleRequest;
import com.metaplatform.ea.role.dto.RoleResponse;
import com.metaplatform.ea.role.dto.UpdateRoleRequest;
import com.metaplatform.ea.role.service.BusinessRoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/roles")
@RequiredArgsConstructor
public class BusinessRoleController {

    private final BusinessRoleService roleService;

    @PostMapping
    public ApiResponse<RoleResponse> create(@Valid @RequestBody CreateRoleRequest request) {
        return ApiResponse.success(roleService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RoleResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(roleService.list(keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<RoleResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(roleService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<RoleResponse> update(@PathVariable UUID id,
                                             @Valid @RequestBody UpdateRoleRequest request) {
        return ApiResponse.success(roleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        roleService.delete(id);
        return ApiResponse.success();
    }
}
