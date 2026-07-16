package com.metaplatform.ont.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "ont_concept_attributes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConceptAttributeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "concept_id", nullable = false, length = 64)
    private String conceptId;

    @Column(name = "attribute_id", nullable = false, length = 64)
    private String attributeId;

    @Column(name = "inherited", nullable = false)
    @Builder.Default
    private Boolean inherited = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
