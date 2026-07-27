package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * API Key 瀹炰綋銆?
 * - key_prefix锛氭槑鏂?Key 鍓?8 浣嶏紝鐢ㄤ簬灞曠ず
 * - key_hash锛歋HA-256 鍝堝笇锛岀敤浜庨獙璇?
 * - status锛欰CTIVE / REVOKED
 */
@Entity
@Table(name = "iam_api_keys")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiKeyEntity {

    public enum Status { SUCCESS, FAILURE, PARTIAL, ACTIVE, REVOKED, INACTIVE, DEPRECATED, ENABLED, DISABLED, PENDING, APPROVED, REJECTED, EXPIRED, ARCHIVED }



    @Id
    @Column(name = "id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "key_prefix", nullable = false, length = 8)
    private String keyPrefix;

    @Column(name = "key_hash", nullable = false, length = 128)
    private String keyHash;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    /**
     * JSON 鏁扮粍瀛楃涓诧紝濡?["ont:read","iam:write"]銆?
     * 淇濈暀鍚戝悗鍏煎锛涚粏绮掑害鏉冮檺瑙?{@link #permissions}銆?
     */
    @Column(name = "scopes", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String scopes;

    /**
     * JSON 鏁扮粍瀛楃涓诧紝濡?[{"resource":"ont:concepts","actions":["read","write"]}]銆?
     * 琛ㄨ揪璧勬簮 + 鎿嶄綔鐨勭粏绮掑害鏉冮檺鑼冨洿銆?
     */
    @Column(name = "permissions", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String permissions;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private Status status;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /**
     * 鍚婇攢鍘熷洜锛堝彲绌猴紝浠?status=REVOKED 鏃舵湁鍊硷級銆?
     */
    @Column(name = "revoked_reason", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String revokedReason;

    /**
     * 鍚婇攢鏃堕棿锛堝彲绌猴紝浠?status=REVOKED 鏃舵湁鍊硷級銆?
     */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }
}
