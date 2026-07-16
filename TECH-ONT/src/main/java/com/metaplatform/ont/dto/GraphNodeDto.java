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

    private Map<String, Object> properties;
}
