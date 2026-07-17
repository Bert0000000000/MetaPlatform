package com.metaplatform.obs.alert.dto;

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
public class NotificationChannelRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "type 不能为空")
    private String type;

    private JsonNode config;
    private Boolean enabled;
}