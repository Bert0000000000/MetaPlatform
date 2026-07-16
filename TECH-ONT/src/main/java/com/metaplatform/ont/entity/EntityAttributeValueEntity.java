package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "ont_entity_attribute")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EntityAttributeValueEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "entity_id", nullable = false, length = 64)
    private String entityId;

    @Column(name = "attribute_id", nullable = false, length = 64)
    private String attributeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value", columnDefinition = "jsonb")
    private JsonNode value;

    @Column(name = "valid", nullable = false)
    @Builder.Default
    private Boolean valid = true;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
