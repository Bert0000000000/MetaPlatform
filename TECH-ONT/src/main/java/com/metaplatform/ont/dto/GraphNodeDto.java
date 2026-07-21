package com.metaplatform.ont.dto;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphNodeDto {

    private String id;

    private String label;

    /**
     * 节点类型：concept | entity | relation。
     * 由 Neo4j label 映射而来，前端按类型染色与筛选。
     */
    private String type;

    private Map<String, Object> properties;
}
