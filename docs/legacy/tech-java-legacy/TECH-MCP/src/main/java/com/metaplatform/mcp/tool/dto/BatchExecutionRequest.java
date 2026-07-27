package com.metaplatform.mcp.tool.dto;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;

@Data
public class BatchExecutionRequest {

    @Valid
    private List<BatchItem> items;

    @Data
    public static class BatchItem {
        private java.util.UUID toolId;
        private String input;
    }
}
