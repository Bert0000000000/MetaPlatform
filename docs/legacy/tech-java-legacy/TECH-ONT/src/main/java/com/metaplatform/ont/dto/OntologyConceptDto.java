package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 本体概念探索 DTO（V12-01 REQ-030 / REQ-031）。
 * 对齐前端 APP-SUPERAI 的 OntologyConcept 类型，作为搜索与详情接口的统一返回结构。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyConceptDto {

    /** 概念 ID（对应 ConceptEntity.conceptId）。 */
    private String id;

    /** 概念名称。 */
    private String name;

    /** 概念定义/描述。 */
    private String definition;

    /** 概念属性列表（包含名称、类型、必填、说明）。 */
    private List<ConceptAttributeDto> attributes;

    /** 概念的实例列表（前 N 条，用于详情展示）。 */
    private List<ConceptInstanceDto> instances;

    /** 关联概念 ID 列表（通过关系类型 source/target 推导）。 */
    private List<String> relatedConcepts;

    /** 标签（从 metadata.tags 解析；为空时为空列表）。 */
    private List<String> tags;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConceptAttributeDto {
        private String name;
        private String type;
        private boolean required;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConceptInstanceDto {
        private String id;
        private String name;
        private Map<String, Object> values;
    }
}
