package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.BatchHandleRequest;
import com.metaplatform.dashboard.service.DashboardTodoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard/todos")
@RequiredArgsConstructor
public class TodoController {
    private final DashboardTodoService service;
    @GetMapping public Mono<List<Map<String, Object>>> list(@RequestParam(required = false) String userId) { return service.getTodos(userId); }
    @GetMapping("/{todoId}") public Mono<Map<String, Object>> get(@PathVariable String todoId) { return service.getTodo(todoId); }
    @PutMapping("/{todoId}/handle") public Mono<Map<String, Object>> handle(@PathVariable String todoId, @RequestBody Object action) { return service.handle(todoId, action); }
    @PutMapping("/batch-handle") public Mono<List<Map<String, Object>>> batch(@RequestBody BatchHandleRequest request) { return service.batchHandle(request.todoIds(), request.action()); }
}
