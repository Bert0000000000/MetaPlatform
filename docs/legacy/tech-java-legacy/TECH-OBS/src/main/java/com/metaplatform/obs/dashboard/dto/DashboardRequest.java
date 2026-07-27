package com.metaplatform.obs.dashboard.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRequest {

    @NotBlank(message = "title 不能为空")
    private String title;
    private String description;
    private JsonNode layout;
    private JsonNode panels;
    private Boolean isPublic;
}