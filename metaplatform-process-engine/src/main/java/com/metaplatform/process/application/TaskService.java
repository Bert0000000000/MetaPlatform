package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessTask;
import com.metaplatform.process.domain.enums.TaskStatus;
import com.metaplatform.process.domain.repository.ProcessTaskRepository;
import com.metaplatform.process.infrastructure.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskService {

    private final ProcessTaskRepository taskRepository;

    public TaskService(ProcessTaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public ProcessTask getById(Long id) {
        return taskRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));
    }

    /**
     * Query user's pending tasks
     */
    public Page<ProcessTask> getPendingTasks(String assigneeId, Pageable pageable) {
        return taskRepository.findByAssigneeIdAndStatus(assigneeId, TaskStatus.PENDING, pageable);
    }

    /**
     * Query user's completed tasks
     */
    public Page<ProcessTask> getCompletedTasks(String assigneeId, Pageable pageable) {
        return taskRepository.findByAssigneeIdAndStatus(assigneeId, TaskStatus.COMPLETED, pageable);
    }

    /**
     * Query all tasks under a process instance
     */
    public List<ProcessTask> getTasksByInstance(Long instanceId) {
        return taskRepository.findByInstanceId(instanceId);
    }
}
