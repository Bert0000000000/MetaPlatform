package com.metaplatform.wfe.apphub.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 应用发布操作日志实体（V14-05）：记录每次发布变更的时间、操作人、动作与备注。
 */
@Entity
@Table(name = "wfe_app_release_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppReleaseLogEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "release_id", nullable = false, length = 64)
    private String releaseId;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "operator", length = 64)
    private String operator;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
