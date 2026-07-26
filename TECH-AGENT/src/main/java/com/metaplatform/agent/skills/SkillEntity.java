package com.metaplatform.agent.skills;

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
@Table(name = "agent_skill")
public class SkillEntity {
    @Id private String id;
    @Column(name="tenant_id", nullable=false, length=64) private String tenantId;
    @Column(name="skill_code", nullable=false, length=128) private String skillCode;
    @Column(name="display_name", nullable=false, length=256) private String displayName;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(name="skill_type", nullable=false, length=32) private String skillType;
    @Column(nullable=false, columnDefinition = "TEXT") private String content;
    @Column(columnDefinition = "TEXT") private String tools;
    @Column(nullable=false) private int version;
    @Column(nullable=false) private boolean enabled;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
}
