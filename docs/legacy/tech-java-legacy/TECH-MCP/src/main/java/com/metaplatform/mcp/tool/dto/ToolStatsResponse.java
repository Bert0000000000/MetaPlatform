package com.metaplatform.mcp.tool.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolStatsResponse {

    private long total;
    private long enabledCount;
    private long disabledCount;
    private Map<String, Long> byStatus;
    private Map<String, Long> byCategory;
    private List<TopTool> topToolsByCalls7d;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopTool {
        private String toolCode;
        private long callCount;
    }
}
