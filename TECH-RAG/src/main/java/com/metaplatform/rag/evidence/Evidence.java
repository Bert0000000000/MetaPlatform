package com.metaplatform.rag.evidence;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Evidence {

    private String evidenceId;
    private Type type;
    private String documentId;
    private String kbId;
    private String concept;
    private String fragment;
    private double score;
    private Instant ts;
    private String title;

    public enum Type { ONTOLOGY_OBJECT, ONTOLOGY_METRIC, DOCUMENT, EXTERNAL, MODEL_DERIVED }

    public static Evidence fromChunk(com.metaplatform.kb.entity.KbChunkEntity chunk, double score, String tenantId) {
        return Evidence.builder()
                .evidenceId("EVD-" + java.util.UUID.randomUUID().toString().replace("-", ""))
                .type(Type.DOCUMENT)
                .documentId(chunk.getDocumentId())
                .kbId(chunk.getChunkId())
                .concept("KBChunk")
                .fragment(chunk.getContent())
                .score(score)
                .ts(java.time.Instant.now())
                .build();
    }

    public static Evidence synthetic(String chunkId, double score, String tenantId, java.util.Map<String, Object> metadata) {
        String fragment = metadata != null && metadata.get("text") != null
                ? String.valueOf(metadata.get("text"))
                : "(synthetic) chunk " + chunkId;
        return Evidence.builder()
                .evidenceId("EVD-" + java.util.UUID.randomUUID().toString().replace("-", ""))
                .type(Type.MODEL_DERIVED)
                .kbId(chunkId)
                .concept("Synthetic")
                .fragment(fragment)
                .score(score)
                .ts(java.time.Instant.now())
                .build();
    }
}