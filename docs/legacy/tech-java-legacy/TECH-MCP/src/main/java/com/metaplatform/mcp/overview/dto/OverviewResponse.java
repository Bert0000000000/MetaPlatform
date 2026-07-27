package com.metaplatform.mcp.overview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MCP Hub 概览页聚合响应。
 *
 * <p>聚合 Server 状态、工具统计、今日调用、Token 消耗、近期错误告警与 Top Tools 排行。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverviewResponse {

    private ServerStats serverStats;
    private ToolStats toolStats;
    private CallStats callStats;
    private TokenStats tokenStats;
    private List<ErrorAlert> errorAlerts;
    private List<TopTool> topTools;
    private List<TrendPoint> callTrend;
    private List<TrendPoint> tokenTrend;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServerStats {
        private long total;
        private long online;
        private long offline;
        private long error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToolStats {
        private long total;
        private long enabled;
        private long disabled;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CallStats {
        private long todayCalls;
        private double successRate;
        private double avgDuration;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenStats {
        private long todayInputTokens;
        private long todayOutputTokens;
        private long todayTotalTokens;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorAlert {
        private String id;
        private String toolCode;
        private String status;
        private String level;
        private String errorMessage;
        private String calledAt;
        private String traceId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopTool {
        private String toolCode;
        private long count;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendPoint {
        private String time;
        private long count;
        private long tokens;
    }
}
