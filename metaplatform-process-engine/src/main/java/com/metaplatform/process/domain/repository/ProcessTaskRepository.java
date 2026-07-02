package com.metaplatform.process.domain.repository;

import com.metaplatform.process.domain.ProcessTask;
import com.metaplatform.process.domain.enums.TaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ProcessTaskRepository extends JpaRepository<ProcessTask, Long> {

    List<ProcessTask> findByInstanceId(Long instanceId);

    Page<ProcessTask> findByAssigneeIdAndStatus(String assigneeId, TaskStatus status, Pageable pageable);

    List<ProcessTask> findByStatusAndDueDateBefore(TaskStatus status, LocalDateTime dueDate);
}
