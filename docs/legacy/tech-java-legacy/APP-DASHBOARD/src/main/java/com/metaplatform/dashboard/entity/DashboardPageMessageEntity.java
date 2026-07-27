package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_message")
@Data
public class DashboardPageMessageEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(name = "msg_id", nullable = false, length = 64) private String msgId;
    @Column(nullable = false, length = 128) private String sender;
    @Column(name = "avatar_class", nullable = false, length = 64) private String avatarClass;
    @Column(length = 64) private String icon;
    @Column(nullable = false, length = 256) private String title;
    @Column(columnDefinition = "TEXT") private String summary;
    @Column(nullable = false, length = 64) private String time;
    @Column(nullable = false, length = 16) private String priority;
    private Boolean unread = false;
    private Integer attachments = 0;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (unread == null) unread = false;
        if (attachments == null) attachments = 0;
        if (sortOrder == null) sortOrder = 0;
    }
}