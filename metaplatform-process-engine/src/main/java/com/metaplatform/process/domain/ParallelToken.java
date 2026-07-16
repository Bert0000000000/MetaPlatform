package com.metaplatform.process.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Tracks parallel execution tokens for PARALLEL gateway branches.
 * Each outgoing branch of a parallel split gets its own token.
 * When all tokens for a given gateway reach COMPLETED status,
 * the parallel join can proceed.
 */
@Entity
@Table(name = "parallel_token")
public class ParallelToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false)
    private Long instanceId;

    @Column(name = "gateway_node_id", nullable = false)
    private String gatewayNodeId;

    @Column(name = "branch_id", nullable = false)
    private String branchId;

    @Column(name = "target_node_id")
    private String targetNodeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TokenStatus status = TokenStatus.ACTIVE;

    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public void markCompleted() {
        this.status = TokenStatus.COMPLETED;
        this.completedAt = LocalDateTime.now();
    }

    public void markFailed() {
        this.status = TokenStatus.FAILED;
        this.completedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return this.status == TokenStatus.ACTIVE;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getInstanceId() { return instanceId; }
    public void setInstanceId(Long instanceId) { this.instanceId = instanceId; }
    public String getGatewayNodeId() { return gatewayNodeId; }
    public void setGatewayNodeId(String gatewayNodeId) { this.gatewayNodeId = gatewayNodeId; }
    public String getBranchId() { return branchId; }
    public void setBranchId(String branchId) { this.branchId = branchId; }
    public String getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(String targetNodeId) { this.targetNodeId = targetNodeId; }
    public TokenStatus getStatus() { return status; }
    public void setStatus(TokenStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    /**
     * Token lifecycle status
     */
    public enum TokenStatus {
        ACTIVE,
        COMPLETED,
        FAILED
    }
}
