package com.metaplatform.appservice.domain.workflow;

import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.security.TenantContext;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 待办任务接口。
 */
@RestController
@RequestMapping("/api/apps/{appId}/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@PathVariable String appId) {
        String userId = TenantContext.currentUserId();
        List<String> roles = TenantContext.currentRoles();
        return ApiResponse.ok(todoService.listTodos(appId, userId, roles), MDC.get("traceId"));
    }

    @GetMapping("/{taskId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String appId, @PathVariable String taskId) {
        return ApiResponse.ok(todoService.getTaskDetail(appId, taskId), MDC.get("traceId"));
    }

    @PostMapping("/{taskId}/complete")
    public ApiResponse<Map<String, String>> complete(@PathVariable String appId,
                                                     @PathVariable String taskId,
                                                     @RequestBody(required = false) Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        todoService.complete(appId, taskId, comment);
        return ApiResponse.ok(Map.of("status", "completed"), MDC.get("traceId"));
    }

    @PostMapping("/{taskId}/reject")
    public ApiResponse<Map<String, String>> reject(@PathVariable String appId,
                                                   @PathVariable String taskId,
                                                   @RequestBody Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        todoService.reject(appId, taskId, comment);
        return ApiResponse.ok(Map.of("status", "rejected"), MDC.get("traceId"));
    }
}
