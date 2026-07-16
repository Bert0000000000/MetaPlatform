package com.metaplatform.wfe.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wfe_process_instance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProcessInstanceEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_definition_id", nullable = false, length = 64)
    private String processDefinitionId;

    @Column(name = "process_key", nullable = false, length = 128)
    private String processKey;

    @Column(name = "business_key", length = 128)
    private String businessKey;

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProcessInstanceStatus status = ProcessInstanceStatus.RUNNING;

    @Column(name = "start_user_id", length = 64)
    private String startUserId;

    @Column(name = "variables", columnDefinition = "TEXT")
    private String variables;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
