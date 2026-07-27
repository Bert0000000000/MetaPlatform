package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 概念测试推理请求（P1-ONT：概念测试推理端点）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptTestRequest {

    /**
     * 输入数据，key 通常为属性编码或概念编码。
     */
    private Map<String, Object> input;

    /**
     * 可选上下文（租户、场景等），当前简化实现暂未使用，预留给后续规则引擎。
     */
    private Map<String, Object> context;
}
