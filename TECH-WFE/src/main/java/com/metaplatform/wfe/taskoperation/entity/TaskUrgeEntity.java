package com.metaplatform.wfe.taskoperation.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "wfe_task_urge")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskUrgeEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @Column(name = "urged_user", nullable = false, length = 64)
    private String urgedUser;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}