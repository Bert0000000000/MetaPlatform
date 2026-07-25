package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "wfe_app_release_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppReleaseLogEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "release_id", nullable = false, length = 64)
    private String releaseId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "operator", length = 64)
    private String operator;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "remark", columnDefinition = "TEXT")
    private Map<String, Object> remark;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
