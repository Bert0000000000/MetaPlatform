package com.metaplatform.ea.process.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_business_process")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "value_stream_id")
    private UUID valueStreamId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "capabilities", columnDefinition = "jsonb")
    private String capabilities;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "process_steps", columnDefinition = "jsonb")
    private String processSteps;

    @Column(name = "version", nullable = false)
    private Integer version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_type", length = 32)
    private String processType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "frequency", length = 32)
    private String frequency;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "application_ids", columnDefinition = "jsonb")
    private String applicationIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "responsible_role_ids", columnDefinition = "jsonb")
    private String responsibleRoleIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bpmn_xml", columnDefinition = "TEXT")
    private String bpmnXml;

}
