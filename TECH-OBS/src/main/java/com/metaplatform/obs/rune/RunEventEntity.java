package com.metaplatform.obs.rune;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * RunEvent 标准事件实体（P8.2）。
 *
 * <p>所有 Agent / Ontology / Document / Action 事件统一写入 {@code obs_run_event}，
 * 支撑全链路可观测 + 合规审计 + 多租户压测分析。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "obs_run_event")
public class RunEventEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="run_id", nullable=false, length=64) private String runId;
    @Column(name="task_id", length=64) private String taskId;
    @Column(name="agent_id", length=64) private String agentId;
    @Column(nullable=false, length=64) private String type;        // RUN_STARTED / CLAIM_PRODUCED / ...
    @Column(columnDefinition="TEXT") private String payload;
    @Column(nullable=false) private Instant ts;
    @Column(name="trace_id", length=128) private String traceId;
}
