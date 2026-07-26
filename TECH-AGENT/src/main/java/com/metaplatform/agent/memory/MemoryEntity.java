package com.metaplatform.agent.memory;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 企业长期记忆数据模型（P7.3）。
 *
 * <p>四层：</p>
 * <ul>
 *   <li>WORKING — 当前会话短期状态（不持久化）</li>
 *   <li>EPISODIC — 历史执行经验</li>
 *   <li>SEMANTIC — 稳定事实、偏好</li>
 *   <li>ORGANIZATIONAL — 企业制度、流程、最佳实践</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "agent_memory")
public class MemoryEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="memory_kind", nullable=false, length=32) private String memoryKind;
    @Column(name="scope", length=128) private String scope;       // agentId / userId / tenantId
    @Column(nullable=false, columnDefinition="TEXT") private String content;
    @Column(name="tags", columnDefinition="TEXT") private String tags;   // JSON array
    @Column(name="source_run_id", length=64) private String sourceRunId;
    @Column(name="confidence", nullable=false) private double confidence;
    @Column(name="pii_redacted", nullable=false) private boolean piiRedacted;
    @Column(name="expires_at") private Instant expiresAt;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @Column(name="created_by", length=64) private String createdBy;

    public enum Kind { EPISODIC, SEMANTIC, ORGANIZATIONAL }
}
