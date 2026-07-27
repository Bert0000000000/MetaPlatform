package com.metaplatform.agent.scheduled;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "agent_scheduled_run")
public class ScheduledAgentEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="agent_id", nullable=false, length=64) private String agentId;
    @Column(name="schedule_kind", nullable=false, length=16) private String scheduleKind;
    @Column(name="cron_expression", length=128) private String cronExpression;
    @Column(name="interval_sec") private Integer intervalSec;
    @Column(name="run_at") private Instant runAt;
    @Column(name="thread_strategy", nullable=false, length=32) private String threadStrategy;
    @Column(name="overlap_policy", nullable=false, length=16) private String overlapPolicy;
    @Column(name="input_payload", columnDefinition="TEXT") private String inputPayload;
    @Column(nullable=false) private boolean enabled;
    @Column(name="last_run_at") private Instant lastRunAt;
    @Column(name="next_run_at") private Instant nextRunAt;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
}
