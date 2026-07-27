package com.metaplatform.ont.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphStatsResponse {

    private long nodeCount;

    private long edgeCount;

    private long conceptCount;

    private long entityCount;

    private List<RelationTypeCount> relationTypes;
}
