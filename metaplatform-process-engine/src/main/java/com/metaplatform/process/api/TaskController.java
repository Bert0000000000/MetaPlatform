package com.metaplatform.process.api;

import com.metaplatform.process.api.dto.TaskCompleteRequest;
import com.metaplatform.process.application.ProcessEngine;
import com.metaplatform.process.application.TaskService;
import com.metaplatform.process.domain.ProcessTask;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService taskService;
    private final ProcessEngine processEngine;

    public TaskController(TaskService taskService, ProcessEngine processEngine) {
        this.taskService = taskService;
        this.processEngine = processEngine;
    }

    @GetMapping("/my/pending")
    public Page<ProcessTask> myPendingTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return taskService.getPendingTasks("api-user",
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @GetMapping("/my/completed")
    public Page<ProcessTask> myCompletedTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return taskService.getCompletedTasks("api-user",
            PageRequest.of(page, size, Sort.by("completedAt").descending()));
    }

    @GetMapping("/{id}")
    public ProcessTask getById(@PathVariable Long id) {
        return taskService.getById(id);
    }

    @PostMapping("/{id}/complete")
    public ProcessTask complete(@PathVariable Long id,
                                 @Valid @RequestBody TaskCompleteRequest request) {
        processEngine.completeTask(
            id,
            "api-user",
            request.getResult(),
            request.getComment(),
            request.getFormData()
        );
        return taskService.getById(id);
    }
}
