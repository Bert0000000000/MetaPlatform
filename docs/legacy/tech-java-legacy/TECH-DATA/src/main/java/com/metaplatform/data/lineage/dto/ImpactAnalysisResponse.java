package com.metaplatform.data.lineage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 节点影响分析响应（BFS 上下游）。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImpactAnalysisResponse {

    private String nodeId;
    private List<String> upstreamNodes;
    private List<String> downstreamNodes;
    private List<String> impactPath;
}
