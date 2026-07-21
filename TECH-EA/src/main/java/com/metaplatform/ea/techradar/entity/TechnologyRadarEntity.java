package com.metaplatform.ea.techradar.entity;

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
@Table(name = "ea_technology_radar",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "name"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyRadarEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String quadrants = "[\"语言与框架\",\"数据与存储\",\"平台与基础设施\",\"工具与流程\"]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String rings = "[\"采纳\",\"试用\",\"评估\",\"暂缓\"]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String items = "[]";

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "active";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
