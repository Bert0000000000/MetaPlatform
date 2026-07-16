package com.metaplatform.ragmdm.domain;

import com.metaplatform.ragmdm.domain.enums.GoldenRecordStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "golden_record")
@Data
@NoArgsConstructor
public class GoldenRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_code", nullable = false, unique = true)
    private String entityCode;

    @Column(name = "data_json", columnDefinition = "TEXT", nullable = false)
    private String dataJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoldenRecordStatus status;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "golden_record_id")
    private List<RecordLink> sourceRecords = new ArrayList<>();

    @Column(name = "match_score")
    private Integer matchScore;

    @Column(name = "source_count")
    private Integer sourceCount;

    @Column(name = "merge_strategy")
    private String mergeStrategy;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (status == null) status = GoldenRecordStatus.ACTIVE;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
