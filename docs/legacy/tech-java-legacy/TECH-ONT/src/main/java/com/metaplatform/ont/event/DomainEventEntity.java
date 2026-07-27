package com.metaplatform.ont.event;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ontology 业务事件实体（P1.1.5）。
 *
 * <p>由业务系统或 Agent 触发，用于 Phase 7 的事件驱动数字员工。
 * 同主题去重由 {@code uk_domain_event} 约束保障。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_domain_event")
public class DomainEventEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "event_code", nullable = false, length = 128)
    private String eventCode;

    @Column(name = "concept_code", nullable = false, length = 64)
    private String conceptCode;

    @Column(name = "object_id", length = 64)
    private String objectId;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(nullable = false)
    private boolean consumed;
}
