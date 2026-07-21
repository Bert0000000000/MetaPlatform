package com.metaplatform.ea.valuestream.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Persistent stage of a value stream. Stages can be linked to capabilities via
 * {@link ValueStreamCapabilityEntity} but can also stand alone for ordering and
 * sequencing purposes.
 */
@Entity
@Table(name = "ea_value_stream_stage",
        uniqueConstraints = @UniqueConstraint(columnNames = {"value_stream_id", "name"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValueStreamStageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "value_stream_id", nullable = false)
    private UUID valueStreamId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "capability_ids", columnDefinition = "jsonb")
    @Builder.Default
    private String capabilityIds = "[]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "outputs", columnDefinition = "jsonb")
    @Builder.Default
    private String outputs = "[]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "participant_role_ids", columnDefinition = "jsonb")
    @Builder.Default
    private String participantRoleIds = "[]";

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}