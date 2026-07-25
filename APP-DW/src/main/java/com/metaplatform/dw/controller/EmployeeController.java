package com.metaplatform.dw.controller;

import com.metaplatform.dw.config.DwProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dw/employees")
public class EmployeeController {
    private final WebClient agentClient;
    private final WebClient taskClient;
    private final WebClient evalClient;

    public EmployeeController(WebClient.Builder builder, DwProperties properties) {
        this.agentClient = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
        this.taskClient = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
        this.evalClient = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
    }

    @GetMapping
    public Mono<Object> list(@RequestParam Map<String, String> params) {
        return agentClient.get().uri(uri -> {
            var b = uri.path("/api/v1/agent/employees");
            params.forEach(b::queryParam);
            return b.build();
        }).retrieve().bodyToMono(Object.class);
    }

    @PostMapping
    public Mono<Object> create(@RequestBody Object body) {
        return agentClient.post().uri("/api/v1/agent/employees").bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/{employeeId}")
    public Mono<Object> get(@PathVariable String employeeId) {
        return agentClient.get().uri("/api/v1/agent/employees/{id}", employeeId).retrieve().bodyToMono(Object.class);
    }

    @PutMapping("/{employeeId}")
    public Mono<Object> update(@PathVariable String employeeId, @RequestBody Object body) {
        return agentClient.put().uri("/api/v1/agent/employees/{id}", employeeId).bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @DeleteMapping("/{employeeId}")
    public Mono<Void> delete(@PathVariable String employeeId) {
        return agentClient.delete().uri("/api/v1/agent/employees/{id}", employeeId).retrieve().bodyToMono(Void.class);
    }

    @PutMapping("/{employeeId}/status")
    public Mono<Object> status(@PathVariable String employeeId, @RequestBody Object body) {
        return agentClient.put().uri("/api/v1/agent/employees/{id}/status", employeeId).bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @PostMapping("/{employeeId}/clone")
    public Mono<Object> clone(@PathVariable String employeeId, @RequestBody Object body) {
        return agentClient.post().uri("/api/v1/agent/employees/{id}/clone", employeeId).bodyValue(body).retrieve().bodyToMono(Object.class);
    }

    @GetMapping("/stats")
    public Mono<Map<String, Object>> stats(@RequestParam(required = false) String userId) {
        Mono<List<Map<String, Object>>> tasksToday = taskClient.get().uri(uri -> uri.path("/api/v1/agent/tasks")
                .queryParam("userId", userId == null ? "" : userId)
                .queryParam("range", "today").build()).retrieve().bodyToMono(new ParameterizedTypeReference<>() {});
        Mono<List<Map<String, Object>>> evals = evalClient.get().uri(uri -> uri.path("/api/v1/agent/evaluations")
                .queryParam("userId", userId == null ? "" : userId).build()).retrieve().bodyToMono(new ParameterizedTypeReference<>() {});
        return Mono.zip(tasksToday, evals).map(tuple -> {
            List<Map<String, Object>> taskList = tuple.getT1();
            List<Map<String, Object>> evalList = tuple.getT2();
            long today = taskList.size();
            long completed = taskList.stream().filter(m -> "COMPLETED".equals(String.valueOf(m.get("status")))).count();
            double completionRate = today == 0 ? 0 : (double) completed / today;
            double avgScore = evalList.stream()
                    .filter(m -> m.get("score") instanceof Number)
                    .mapToDouble(m -> ((Number) m.get("score")).doubleValue())
                    .average().orElse(0);
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("todayTasks", today);
            stats.put("completedTasks", completed);
            stats.put("completionRate", completionRate);
            stats.put("avgRating", avgScore);
            stats.put("evaluationCount", evalList.size());
            return stats;
        });
    }
}