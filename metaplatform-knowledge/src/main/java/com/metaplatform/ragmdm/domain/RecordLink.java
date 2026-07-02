package com.metaplatform.ragmdm.domain;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "record_link")
@Data
@NoArgsConstructor
public class RecordLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "golden_record_id", nullable = false)
    private Long goldenRecordId;

    @Column(name = "source_system", nullable = false)
    private String sourceSystem;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    @Column(name = "source_data", columnDefinition = "TEXT")
    private String sourceData;

    @Column(name = "match_score")
    private Integer matchScore;

    @Column(name = "match_rule")
    private String matchRule;

    @Column(name = "linked_at")
    private LocalDateTime linkedAt;

    @PrePersist
    public void prePersist() {
        if (linkedAt == null) linkedAt = LocalDateTime.now();
    }
}
