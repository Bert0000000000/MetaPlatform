package com.metaplatform.ea.valuestream.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_value_stream_capability",
        uniqueConstraints = @UniqueConstraint(columnNames = {"value_stream_id", "capability_id", "stage_name"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValueStreamCapabilityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "value_stream_id", nullable = false)
    private UUID valueStreamId;

    @Column(name = "capability_id", nullable = false)
    private UUID capabilityId;

    @Column(name = "stage_name", length = 256)
    private String stageName;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
