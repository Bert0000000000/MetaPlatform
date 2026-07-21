package com.metaplatform.ea.ontmapping.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_ontology_change_event")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyChangeEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "concept_id", nullable = false, length = 128)
    private String conceptId;

    @Column(name = "concept_code", length = 128)
    private String conceptCode;

    @Column(name = "concept_name", length = 256)
    private String conceptName;

    @Column(name = "change_type", nullable = false, length = 64)
    private String changeType;

    @Column(name = "rule_id")
    private UUID ruleId;

    @Column(name = "asset_type", length = 64)
    private String assetType;

    @Column(name = "asset_id")
    private UUID assetId;

    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "review_ticket_id")
    private UUID reviewTicketId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "payload", columnDefinition = "jsonb")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
