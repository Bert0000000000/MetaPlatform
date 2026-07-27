package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.config.DashboardProperties;
import com.metaplatform.dashboard.dto.DashboardSummaryDto;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.List;
import java.util.Map;

@Service
public class DashboardSummaryService {
    private final WebClient wfeClient;
    private final WebClient obsClient;

    public DashboardSummaryService(WebClient.Builder builder, DashboardProperties properties) {
        this.wfeClient = builder.clone().baseUrl(properties.getWfeBaseUrl()).build();
        this.obsClient = builder.clone().baseUrl(properties.getObsBaseUrl()).build();
    }

    public Mono<DashboardSummaryDto> getSummary(String userId) {
        Mono<List<Map<String, Object>>> todos = wfeClient.get().uri(uri -> uri.path("/api/v1/wfe/tasks/todo").queryParam("userId", userId).build()).retrieve().bodyToMono(new ParameterizedTypeReference<>() {});
        Mono<List<Map<String, Object>>> metrics = obsClient.get().uri(uri -> uri.path("/api/v1/obs/dashboard/cards").queryParam("userId", userId).build()).retrieve().bodyToMono(new ParameterizedTypeReference<>() {});
        return Mono.zip(todos, metrics).map(tuple -> new DashboardSummaryDto(tuple.getT1().size(), 0, tuple.getT1().size(), tuple.getT2().size()));
    }
}
