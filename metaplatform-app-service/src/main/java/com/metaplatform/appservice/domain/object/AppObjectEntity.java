package com.metaplatform.appservice.domain.object;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 对象元数据（业务对象的"概念层"）。
 * 真正的动态业务数据放在 {@code data_table_name} 指向的物理表。
 */
@Entity
@Table(name = "app_objects",
        uniqueConstraints = @UniqueConstraint(name = "uk_app_objects_app_code", columnNames = {"app_id", "code"}))
public class AppObjectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "app_id", nullable = false)
    private Long appId;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "schema_json", nullable = false, columnDefinition = "TEXT")
    private String schemaJson;

    @Column(name = "data_table_name", nullable = false, length = 128)
    private String dataTableName;

    @Column(name = "ontology_object_id", length = 128)
    private String ontologyObjectId;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AppObjectEntity() {}

    // —— Getter / Setter —— //
    public Long getId() { return id; }
    public Long getAppId() { return appId; }
    public void setAppId(Long appId) { this.appId = appId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSchemaJson() { return schemaJson; }
    public void setSchemaJson(String schemaJson) { this.schemaJson = schemaJson; }
    public String getDataTableName() { return dataTableName; }
    public void setDataTableName(String dataTableName) { this.dataTableName = dataTableName; }
    public String getOntologyObjectId() { return ontologyObjectId; }
    public void setOntologyObjectId(String ontologyObjectId) { this.ontologyObjectId = ontologyObjectId; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
