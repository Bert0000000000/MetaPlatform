package com.metaplatform.data.lineage;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.lineage.dto.ImpactAnalysisResponse;
import com.metaplatform.data.lineage.dto.LineageGraphResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据血缘端点。
 *
 * <p>对应 Python app/api/v1/lineage.py（3 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/lineage")
@RequiredArgsConstructor
public class LineageController {

    private final LineageService lineageService;

    /**
     * 获取默认血缘图。
     */
    @GetMapping
    public ApiResponse<LineageGraphResponse> getLineage() {
        return ApiResponse.success(lineageService.getLineage());
    }

    /**
     * 按节点 ID 获取血缘子图。
     */
    @GetMapping("/nodes/{nodeId}")
    public ApiResponse<LineageGraphResponse> getByNode(@PathVariable String nodeId) {
        return ApiResponse.success(lineageService.getByNode(nodeId));
    }

    /**
     * 节点影响分析。
     */
    @GetMapping("/nodes/{nodeId}/impact")
    public ApiResponse<ImpactAnalysisResponse> analyzeImpact(@PathVariable String nodeId) {
        return ApiResponse.success(lineageService.analyzeImpact(nodeId));
    }
}
