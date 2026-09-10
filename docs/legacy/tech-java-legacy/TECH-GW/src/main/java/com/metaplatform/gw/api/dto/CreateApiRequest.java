package com.metaplatform.gw.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateApiRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "path 不能为空")
    private String path;

    @NotBlank(message = "method 不能为空")
    @Pattern(regexp = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS", message = "method 必须为合法 HTTP 方法")
    private String method;

    private String groupName;

    private String version;

    private String targetService;

    private String description;

    private String status;

    private String tenantId;

    private Map<String, Object> metadata;

    private Map<String, Object> requestSchema;

    private Map<String, Object> responseSchema;

    private Map<String, Object> parameters;

    private Map<String, Object> examples;
}
