package com.metaplatform.rag.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.OffsetDateTime;

@Entity
@Table(name = "rag_search_feedback")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchFeedbackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "query", nullable = false, columnDefinition = "TEXT")
    private String query;

    @Column(name = "kb_id")
    private UUID kbId;

    @Column(name = "chunk_id")
    private UUID chunkId;

    @Column(name = "score")
    private Double score;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "feedback_type", nullable = false, length = 50)
    private String feedbackType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

}
