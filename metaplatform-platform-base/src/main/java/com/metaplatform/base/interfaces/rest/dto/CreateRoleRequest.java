package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CreateRoleRequest(
    @NotBlank String name,
    String description,
    List<PermissionSpec> permissions
) {
    public record PermissionSpec(
        @NotBlank String resource,
        @NotBlank String action
    ) {}
}
