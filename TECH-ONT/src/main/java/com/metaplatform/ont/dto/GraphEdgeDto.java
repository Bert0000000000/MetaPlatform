package com.metaplatform.ont.dto;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphEdgeDto {

    private String id;

    private String source;

    private String target;

    /**
     * Neo4j 关系类型（如 RELATES_TO）。
     */
    private String type;

    /**
     * 前端展示用标签（取自 relationTypeCode 或 type）。
     */
    private String label;

    private Map<String, Object> properties;
}
