package com.metaplatform.ont.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphQueryResponse {

    private List<GraphNodeDto> nodes;

    private List<GraphEdgeDto> edges;
}
