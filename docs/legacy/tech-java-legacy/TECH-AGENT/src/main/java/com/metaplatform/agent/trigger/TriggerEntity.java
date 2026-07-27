package com.metaplatform.agent.trigger;

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
@Table(name = "agent_trigger")
public class TriggerEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="trigger_code", nullable=false, length=128) private String triggerCode;
    @Column(name="event_topic", nullable=false, length=128) private String eventTopic;
    @Column(name="event_filter", columnDefinition="TEXT") private String eventFilter;
    @Column(name="agent_id", nullable=false, length=64) private String agentId;
    @Column(name="input_template", columnDefinition="TEXT") private String inputTemplate;
    @Column(nullable=false) private boolean enabled;
    @Column(name="budget_tokens", nullable=false) private int budgetTokens;
    @Column(name="cooldown_sec", nullable=false) private int cooldownSec;
    @Column(name="last_fire_at") private Instant lastFireAt;
    @Column(name="fire_count", nullable=false) private int fireCount;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
}
