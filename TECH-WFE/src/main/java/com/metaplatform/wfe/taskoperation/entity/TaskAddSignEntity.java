package com.metaplatform.wfe.taskoperation.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "wfe_task_addsign")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAddSignEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @Column(name = "addsign_user", nullable = false, length = 64)
    private String addsignUser;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}