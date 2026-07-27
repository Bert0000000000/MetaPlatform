package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.config.DashboardProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard/metrics")
public class MetricsController {
    private final WebClient client;
    public MetricsController(WebClient.Builder builder, DashboardProperties properties) { this.client = builder.clone().baseUrl(properties.getObsBaseUrl()).build(); }
    @GetMapping public Mono<Object> list(@RequestParam Map<String, String> params) { return client.get().uri(uri -> { var b=uri.path("/api/v1/obs/dashboard/cards"); params.forEach(b::queryParam); return b.build(); }).retrieve().bodyToMono(Object.class); }
    @GetMapping("/{metricId}/data") public Mono<Object> data(@PathVariable String metricId) { return client.get().uri("/api/v1/obs/metrics/{id}/data", metricId).retrieve().bodyToMono(Object.class); }
    @GetMapping("/{metricId}/trend") public Mono<Object> trend(@PathVariable String metricId) { return client.get().uri(uri -> uri.path("/api/v1/obs/dashboard/trend").queryParam("metricId", metricId).build()).retrieve().bodyToMono(Object.class); }
}
