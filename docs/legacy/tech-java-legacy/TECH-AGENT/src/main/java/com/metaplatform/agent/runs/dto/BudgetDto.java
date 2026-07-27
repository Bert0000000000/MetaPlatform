package com.metaplatform.agent.runs.dto;

import lombok.*;
import java.math.BigDecimal;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BudgetDto {
    private Integer tokens;
    private BigDecimal cost;
    private Long wallTimeMs;
}
