package com.metaplatform.mcp.alert.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAlertRuleRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String metric;

    @NotNull
    private BigDecimal threshold;

    @NotNull
    private Integer windowMinutes;

    @NotNull
    private Boolean enabled;

    private List<String> notifyChannels;
}
