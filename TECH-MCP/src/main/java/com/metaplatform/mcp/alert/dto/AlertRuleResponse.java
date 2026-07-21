package com.metaplatform.mcp.alert.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleResponse {

    private UUID id;
    private String name;
    private String metric;
    private BigDecimal threshold;
    private Integer windowMinutes;
    private Boolean enabled;
    private List<String> notifyChannels;
    private Instant createdAt;
    private Instant updatedAt;
}
