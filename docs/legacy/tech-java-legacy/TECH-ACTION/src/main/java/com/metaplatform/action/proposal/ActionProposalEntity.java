package com.metaplatform.action.proposal;

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
@Table(name = "action_proposal")
public class ActionProposalEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="run_id", nullable=false, length=64) private String runId;
    @Column(name="action_code", nullable=false, length=128) private String actionCode;
    @Column(name="target_object_id", length=64) private String targetObjectId;
    @Column(name="concept_code", length=64) private String conceptCode;
    @Column(name="parameters", columnDefinition="TEXT") private String parameters;
    @Column(name="risk_level", nullable=false, length=16) private String riskLevel;
    @Column(name="idempotency_key", length=128) private String idempotencyKey;
    @Column(name="requires_approval", nullable=false) private boolean requiresApproval;
    @Column(nullable=false, length=16) private String status;
    @Column(name="approver", length=64) private String approver;
    @Column(name="approval_id", length=64) private String approvalId;
    @Column(name="executed_at") private Instant executedAt;
    @Column(name="error_message", columnDefinition="TEXT") private String errorMessage;
    @Column(name="evidence_refs", columnDefinition="TEXT") private String evidenceRefs;
    @Column(name="reason", columnDefinition="TEXT") private String reason;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
}
