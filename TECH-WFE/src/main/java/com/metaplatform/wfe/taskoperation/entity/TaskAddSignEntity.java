package com.metaplatform.wfe.taskoperation.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "wfe_task_addsign")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAddSignEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "addsign_user", nullable = false, length = 64)
    private String addsignUser;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

}
