package com.metaplatform.data.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "data_mapping")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataMappingEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "datasource_id", nullable = false, length = 64)
    private String datasourceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_table", nullable = false, length = 256)
    private String sourceTable;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ontology_entity_id", nullable = false, length = 64)
    private String ontologyEntityId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "sync_mode", nullable = false, length = 16)
    private String syncMode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cron_expression", length = 64)
    private String cronExpression;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
