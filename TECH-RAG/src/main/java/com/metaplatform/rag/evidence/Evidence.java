package com.metaplatform.rag.evidence;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 证据（P2.2.4）。
 *
 * <p>每次检索命中都必须返回 Evidence，包含来源文档、片段、时间戳。
 * 这是 Ontology-Native DeerFlow 中 Claim 与答案之间的强制桥梁。</p>
 */
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
}
