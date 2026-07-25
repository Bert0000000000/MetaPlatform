package com.metaplatform.wfe.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "wfe_process_definition")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDefinitionEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_key", nullable = false, length = 128)
    private String processKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "version", nullable = false)
    private Integer version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bpmn_xml", nullable = false, columnDefinition = "TEXT")
    private Map<String, Object> bpmnXml;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private ProcessDefinitionStatus status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "deployed_by", length = 64)
    private String deployedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "flowgram_json", columnDefinition = "TEXT")
    private Map<String, Object> flowgramJson;

}
