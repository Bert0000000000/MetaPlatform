package com.metaplatform.ont.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 记录每次本体自动发现任务
 */
@Entity
@Table(name = "ont_discovery_task")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OntologyDiscoveryEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    @Column(name = "source_id", nullable = false, length = 64)
    private String sourceId;

    @Column(name = "source_type", nullable = false, length = 32)
    private String sourceType;

    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private String status = "PENDING"; // PENDING / RUNNING / COMPLETED / FAILED

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "error_message", length = 2048)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}