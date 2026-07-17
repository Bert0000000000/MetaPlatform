package com.metaplatform.wfe.taskoperation.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "wfe_task_delegation")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskDelegationEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @Column(name = "from_user", nullable = false, length = 64)
    private String fromUser;

    @Column(name = "to_user", nullable = false, length = 64)
    private String toUser;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}