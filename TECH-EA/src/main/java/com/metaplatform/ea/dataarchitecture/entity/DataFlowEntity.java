package com.metaplatform.ea.dataarchitecture.entity;

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
@Table(name = "ea_data_flow")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataFlowEntity {

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

    @Column(name = "source_entity_id")
    private UUID sourceEntityId;

    @Column(name = "target_entity_id")
    private UUID targetEntityId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "flow_type", length = 64)
    private String flowType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "schedule", length = 128)
    private String schedule;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
