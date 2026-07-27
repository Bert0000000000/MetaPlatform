package com.metaplatform.ont.graph.node;

import lombok.*;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Concept")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConceptNode {

    @Id
    private String id;

    private String tenantId;

    private String code;

    private String name;

    private String description;
}
