package com.metaplatform.wfe.form.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "wfe_form_definition")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FormDefinitionEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "app_id", length = 64)
    private String appId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "global_settings", columnDefinition = "TEXT")
    private String globalSettings;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "linkage_rules", columnDefinition = "TEXT")
    private String linkageRules;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "scripts", columnDefinition = "TEXT")
    private String scripts;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
