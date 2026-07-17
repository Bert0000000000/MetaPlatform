package com.metaplatform.obs.topology.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceDependenciesResponse {
    private String service;
    private List<String> upstream;
    private List<String> downstream;
}