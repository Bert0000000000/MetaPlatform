package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 概念测试推理结果（P1-ONT：概念测试推理端点）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptTestResponse {

    /**
     * 输入是否命中概念的关联属性或概念编码。
     */
    private boolean matched;

    /**
     * 解析得到的值：命中属性的 key->value 映射，或概念编码对应的输入值。
     */
    private Object resolvedValue;

    /**
     * 人类可读的推理说明。
     */
    private String explanation;
}
