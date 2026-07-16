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

    private String type;

    private Map<String, Object> properties;
}
