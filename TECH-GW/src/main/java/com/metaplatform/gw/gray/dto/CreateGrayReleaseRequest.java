package com.metaplatform.gw.gray.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateGrayReleaseRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    private UUID apiId;

    @NotBlank(message = "strategy 不能为空")
    @Pattern(regexp = "PERCENTAGE|HEADER|IP|USER", message = "strategy 必须为 PERCENTAGE/HEADER/IP/USER")
    private String strategy;

    private String newVersion;
    private String oldVersion;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String tenantId;
    private Map<String, Object> strategyConfig;
}
