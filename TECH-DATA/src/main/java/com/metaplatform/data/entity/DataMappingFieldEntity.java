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
@Table(name = "data_mapping_field")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataMappingFieldEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "mapping_id", nullable = false, length = 64)
    private String mappingId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_field", nullable = false, length = 256)
    private String sourceField;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_type", nullable = false, length = 64)
    private String sourceType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ontology_attribute", nullable = false, length = 256)
    private String ontologyAttribute;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 64)
    private String targetType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "transform_expression", length = 1024)
    private String transformExpression;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
