package com.metaplatform.ea.dataarchitecture.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_data_flow")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataFlowEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(name = "source_entity_id", nullable = false)
    private UUID sourceEntityId;

    @Column(name = "target_entity_id", nullable = false)
    private UUID targetEntityId;

    @Column(name = "flow_type", length = 64)
    private String flowType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 128)
    private String schedule;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
