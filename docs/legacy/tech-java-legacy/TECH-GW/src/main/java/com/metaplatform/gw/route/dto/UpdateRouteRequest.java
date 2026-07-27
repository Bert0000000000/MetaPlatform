package com.metaplatform.gw.route.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRouteRequest {

    private String name;
    private String uri;
    private List<CreateRouteRequest.PredicateDto> predicates;
    private List<CreateRouteRequest.FilterDto> filters;
    private Integer priority;
    private Boolean enabled;
}
