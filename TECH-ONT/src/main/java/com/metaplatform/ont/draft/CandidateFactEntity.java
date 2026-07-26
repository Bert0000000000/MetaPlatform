package com.metaplatform.ont.draft;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Candidate Fact（P1.3.1）。
 *
 * <p>每条草稿由若干候选事实组成。每个候选事实绑定：</p>
 * <ul>
 *   <li>概念 / 对象 / 属性</li>
 *   <li>候选值</li>
 *   <li>证据引用（KB Document、Ontology Object、外部 URL）</li>
 *   <li>冲突级别与人工决策</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_candidate_fact")
public class CandidateFactEntity {

    @Id
    private String id;

    @Column(name = "draft_id", nullable = false, length = 64)
    private String draftId;

    @Column(name = "concept_code", nullable = false, length = 64)
    private String conceptCode;

    @Column(name = "object_id", length = 64)
    private String objectId;

    @Column(nullable = false, length = 128)
    private String property;

    @Column(name = "proposed_value", columnDefinition = "TEXT")
    private String proposedValue;

    @Column(name = "evidence_refs", columnDefinition = "TEXT")
    private String evidenceRefs;

    @Column(nullable = false)
    private double confidence;

    @Column(name = "conflict_level", nullable = false, length = 16)
    private String conflictLevel;

    @Column(nullable = false, length = 16)
    private String decision;

    @Column(name = "merged_value", columnDefinition = "TEXT")
    private String mergedValue;

    @Column(length = 64)
    private String reviewer;

    public enum ConflictLevel { NONE, LOW, MEDIUM, HIGH }
    public enum Decision { PENDING, ACCEPTED, REJECTED, MERGED }
}
