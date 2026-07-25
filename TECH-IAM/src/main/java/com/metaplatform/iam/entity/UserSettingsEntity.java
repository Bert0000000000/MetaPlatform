package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "iam_user_settings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettingsEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "language", nullable = false, length = 16)
    private String language;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "date_format", nullable = false, length = 64)
    private String dateFormat;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "default_page", nullable = false, length = 128)
    private String defaultPage;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "theme", nullable = false, length = 16)
    private String theme;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "layout", nullable = false, length = 1024)
    private String layout;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
