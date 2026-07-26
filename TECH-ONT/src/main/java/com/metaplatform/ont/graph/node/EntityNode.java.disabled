package com.metaplatform.ont.graph.node;

import lombok.*;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Entity")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EntityNode {

    @Id
    private String id;

    private String tenantId;

    private String conceptId;

    private String conceptCode;

    private String code;

    private String name;
}
