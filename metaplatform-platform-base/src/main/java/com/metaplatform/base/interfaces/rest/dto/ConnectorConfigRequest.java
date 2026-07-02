package com.metaplatform.base.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record ConnectorConfigRequest(
    @NotBlank String id,
    @NotBlank String type,  // REST, GRPC, JDBC
    @NotBlank String baseUrl,
    Map<String, String> headers,
    Map<String, String> fieldMapping
) {}
