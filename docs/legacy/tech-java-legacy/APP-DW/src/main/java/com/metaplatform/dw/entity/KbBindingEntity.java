package com.metaplatform.dw.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "dw_kb_binding")
@Data
public class KbBindingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String bindingId;
    private String employeeId;
    private String kbId;
    private String retrievalConfigId;
    private Integer priority;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (bindingId == null) bindingId = java.util.UUID.randomUUID().toString();
        if (priority == null) priority = 0;
        if (status == null) status = "ACTIVE";
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}