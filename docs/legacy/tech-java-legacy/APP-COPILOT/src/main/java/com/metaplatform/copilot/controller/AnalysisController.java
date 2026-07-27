package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.config.CopilotProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/copilot/analysis")
public class AnalysisController {
    private final WebClient llmClient;
    private final WebClient dataClient;
    private final List<Map<String, Object>> historyStore = new ArrayList<>();
    private final Map<String, Integer> historyCounter = new ConcurrentHashMap<>();

    public AnalysisController(WebClient.Builder builder, CopilotProperties properties) {
        this.llmClient = builder.clone().baseUrl(properties.getLlmgwBaseUrl()).build();
        this.dataClient = builder.clone().baseUrl(properties.getDataBaseUrl()).build();
    }

    @PostMapping("/query")
    public Mono<Object> query(@RequestBody Map<String, Object> request) {
        return llmClient.post()
                .uri("/api/v1/llmgw/nl2sql")
                .bodyValue(Map.of(
                        "question", request.getOrDefault("question", ""),
                        "schema", request.getOrDefault("schema", ""),
                        "dialect", request.getOrDefault("dialect", "POSTGRES")
                ))
                .retrieve()
                .bodyToMono(Object.class)
                .map(resp -> {
                    recordHistory("NL2SQL", request.get("question"), resp);
                    return resp;
                });
    }

    @PostMapping("/sql/generate")
    public Mono<Object> generateSql(@RequestBody Map<String, Object> request) {
        return llmClient.post()
                .uri("/api/v1/llmgw/nl2sql")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Object.class);
    }

    @PostMapping("/sql/execute")
    public Mono<Object> executeSql(@RequestBody Map<String, Object> request) {
        return dataClient.post()
                .uri("/api/v1/data/query")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Object.class);
    }

    @GetMapping("/history")
    public List<Map<String, Object>> history(@RequestParam(required = false) String userId,
                                              @RequestParam(defaultValue = "50") int limit) {
        int size = Math.min(limit, historyStore.size());
        return historyStore.subList(Math.max(0, historyStore.size() - size), historyStore.size());
    }

    private void recordHistory(String type, Object query, Object result) {
        Map<String, Object> record = Map.of(
                "id", java.util.UUID.randomUUID().toString(),
                "type", type,
                "query", query == null ? "" : query.toString(),
                "result", result == null ? "" : result.toString(),
                "timestamp", java.time.Instant.now().toString()
        );
        historyStore.add(record);
        if (historyStore.size() > 200) historyStore.remove(0);
        historyCounter.merge(type, 1, Integer::sum);
    }
}