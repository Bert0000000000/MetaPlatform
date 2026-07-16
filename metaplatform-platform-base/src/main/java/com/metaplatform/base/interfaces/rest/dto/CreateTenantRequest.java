package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTenantRequest(
    @NotBlank String name,
    @NotBlank String slug
) {}
