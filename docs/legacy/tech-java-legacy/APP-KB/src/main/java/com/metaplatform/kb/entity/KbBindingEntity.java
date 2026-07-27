package com.metaplatform.kb.entity;

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
@Table(name = "kb_kb_binding")
public class KbBindingEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "kb_id", nullable = false, length = 64)
    private String kbId;

    @Column(name = "bind_type", nullable = false, length = 32)
    private String bindType;

    @Column(name = "bind_key", nullable = false, length = 128)
    private String bindKey;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum BindType { AGENT, AGENT_SPEC, ONTOLOGY_OBJECT, APP_PAGE }
}
