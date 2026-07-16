package com.metaplatform.wfe.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wfe_process_definition",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wfe_pd_tenant_key_version",
                columnNames = {"tenant_id", "process_key", "version"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProcessDefinitionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_key", nullable = false, length = 128)
    private String processKey;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "bpmn_xml", nullable = false, columnDefinition = "TEXT")
    private String bpmnXml;

    @Column(name = "status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProcessDefinitionStatus status = ProcessDefinitionStatus.DEPLOYED;

    @Column(name = "deployed_by", length = 64)
    private String deployedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
