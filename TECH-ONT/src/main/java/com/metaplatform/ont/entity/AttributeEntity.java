package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "ont_attributes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttributeEntity {

    @Id
    @Column(name = "attribute_id", nullable = false, length = 64)
    private String attributeId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "data_type", nullable = false, length = 32)
    private String dataType;

    @Column(name = "required", nullable = false)
    @Builder.Default
    private Boolean required = false;

    @Column(name = "unique_value", nullable = false)
    @Builder.Default
    private Boolean unique = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_value", columnDefinition = "jsonb")
    private JsonNode defaultValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "enum_values", columnDefinition = "jsonb")
    private JsonNode enumValues;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "constraints", columnDefinition = "jsonb")
    private JsonNode constraints;

    @Column(name = "unit", length = 32)
    private String unit;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
