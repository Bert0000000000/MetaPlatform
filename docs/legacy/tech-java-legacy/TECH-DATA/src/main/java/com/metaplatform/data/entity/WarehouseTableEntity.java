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
@Table(name = "warehouse_table")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WarehouseTableEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "layer", nullable = false, length = 32)
    private String layer;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "database_name", nullable = false, length = 128)
    private String databaseName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "table_name", nullable = false, length = 256)
    private String tableName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "columns_json", columnDefinition = "jsonb")
    private String columnsJson;

    @Column(name = "row_count", nullable = false)
    private Long rowCount;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "last_modified_at")
    private OffsetDateTime lastModifiedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
