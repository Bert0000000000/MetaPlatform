package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "iam_user_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSettingsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "user_id", nullable = false, unique = true, length = 64)
    private String userId;

    @Column(name = "language", nullable = false, length = 16)
    @Builder.Default
    private String language = "zh-CN";

    @Column(name = "timezone", nullable = false, length = 64)
    @Builder.Default
    private String timezone = "Asia/Shanghai";

    @Column(name = "date_format", nullable = false, length = 64)
    @Builder.Default
    private String dateFormat = "YYYY-MM-DD HH:mm:ss";

    @Column(name = "default_page", nullable = false, length = 128)
    @Builder.Default
    private String defaultPage = "/dashboard";

    @Column(name = "theme", nullable = false, length = 16)
    @Builder.Default
    private String theme = "light";

    @Column(name = "layout", nullable = false, length = 1024)
    @Builder.Default
    private String layout = "[]";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
