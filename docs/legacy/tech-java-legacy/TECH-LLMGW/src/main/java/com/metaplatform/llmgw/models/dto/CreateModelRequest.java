package com.metaplatform.llmgw.models.dto;

import java.math.BigDecimal;
import java.util.Map;

public record CreateModelRequest(
    String provider,
    String modelId,
    String displayName,
    String modality,
    Integer contextWindow,
    Integer maxOutputTokens,
    BigDecimal inputPricePer1k,
    BigDecimal outputPricePer1k,
    Map<String, Object> capabilities
) {}
