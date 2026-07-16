package com.metaplatform.ont.graph.edge;

import com.metaplatform.ont.graph.node.EntityNode;
import lombok.*;
import org.springframework.data.neo4j.core.schema.RelationshipId;
import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;

import java.util.Map;

@RelationshipProperties
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RelationEdge {

    @RelationshipId
    private Long id;

    @TargetNode
    private EntityNode target;

    private String relationId;

    private String tenantId;

    private String relationTypeCode;

    private String sourceId;

    private String targetId;

    private Map<String, Object> properties;
}
