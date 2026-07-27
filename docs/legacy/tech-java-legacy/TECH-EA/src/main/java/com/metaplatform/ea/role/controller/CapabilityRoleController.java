package com.metaplatform.ea.role.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.role.dto.AssignRoleRequest;
import com.metaplatform.ea.role.dto.CapabilityRoleResponse;
import com.metaplatform.ea.role.service.CapabilityRoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/capabilities/{capabilityId}/roles")
@RequiredArgsConstructor
public class CapabilityRoleController {

    private final CapabilityRoleService capabilityRoleService;

    @PostMapping
    public ApiResponse<CapabilityRoleResponse> assignRole(@PathVariable UUID capabilityId,
                                                          @Valid @RequestBody AssignRoleRequest request) {
        return ApiResponse.success(capabilityRoleService.assignRole(capabilityId, request));
    }

    @GetMapping
    public ApiResponse<List<CapabilityRoleResponse>> getRoles(@PathVariable UUID capabilityId) {
        return ApiResponse.success(capabilityRoleService.getRolesForCapability(capabilityId));
    }

    @DeleteMapping("/{roleId}")
    public ApiResponse<Void> unassignRole(@PathVariable UUID capabilityId,
                                          @PathVariable UUID roleId) {
        capabilityRoleService.unassignRole(capabilityId, roleId);
        return ApiResponse.success();
    }
}
