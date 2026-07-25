package com.metaplatform.ea.valuestream.entity;

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
@Table(name = "ea_value_stream_capability")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValueStreamCapabilityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "value_stream_id", nullable = false)
    private UUID valueStreamId;

    @Column(name = "capability_id", nullable = false)
    private UUID capabilityId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "stage_name", length = 256)
    private String stageName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
