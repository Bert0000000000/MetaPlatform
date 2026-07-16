package com.metaplatform.gw.route.dto;

import jakarta.validation.constraints.NotBlank;
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
public class CreateRouteRequest {

    @NotBlank(message = "routeId 不能为空")
    private String routeId;

    private String name;

    @NotBlank(message = "uri 不能为空")
    private String uri;

    private List<PredicateDto> predicates;

    private List<FilterDto> filters;

    private Integer priority;

    private Boolean enabled;

    private String tenantId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PredicateDto {
        private String name;
        private Map<String, String> args;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FilterDto {
        private String name;
        private Map<String, String> args;
    }
}
