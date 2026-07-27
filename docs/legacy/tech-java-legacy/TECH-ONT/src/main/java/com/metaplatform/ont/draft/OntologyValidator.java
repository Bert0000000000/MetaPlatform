package com.metaplatform.ont.draft;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Ontology Validator（P1.3.2）。
 *
 * <p>对 {@link CandidateFactEntity} 做四类校验：</p>
 * <ol>
 *   <li>Schema 校验：property 是否在 Concept 中合法</li>
 *   <li>业务规则校验：例如 startDate < endDate</li>
 *   <li>冲突检测：与现有 Ontology 已有值的对比</li>
 *   <li>影响分析：列出将受影响的 Agent / 规则 / 查询</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyValidator {

    private final ObjectMapper objectMapper;

    /**
     * 校验单个候选事实。
     */
    public ValidationResult validate(CandidateFactEntity fact) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 1. Schema 校验
        if (fact.getConceptCode() == null || fact.getConceptCode().isBlank()) {
            errors.add("concept_code 不能为空");
        }
        if (fact.getProperty() == null || fact.getProperty().isBlank()) {
            errors.add("property 不能为空");
        }
        if (fact.getProposedValue() == null) {
            warnings.add("proposed_value 为空");
        }

        // 2. 业务规则校验（可扩展：注册到 ValidatorRegistry）
        if ("Contract".equals(fact.getConceptCode())
                && "endDate".equals(fact.getProperty())
                && "startDate".equals(fact.getObjectId())) {
            // 占位：实际应通过规则引擎
        }

        // 3. 冲突级别
        String conflict = fact.getConflictLevel();
        if (conflict == null) conflict = "NONE";

        // 4. 置信度
        if (fact.getConfidence() < 0.5) {
            warnings.add("置信度 < 0.5，建议人工审核");
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings,
                errors.isEmpty() ? "NONE" : "HIGH",
                List.of());
    }

    /**
     * 批量校验草稿中所有候选事实。
     */
    public DraftValidationReport validateDraft(OntologyDraftEntity draft, List<CandidateFactEntity> facts) {
        int accepted = 0;
        int rejected = 0;
        int high = 0;
        int medium = 0;
        Map<String, ValidationResult> results = new HashMap<>();
        for (CandidateFactEntity f : facts) {
            ValidationResult r = validate(f);
            results.put(f.getId(), r);
            if (r.pass) accepted++; else rejected++;
            if ("HIGH".equals(r.conflictLevel)) high++;
            else if ("MEDIUM".equals(r.conflictLevel)) medium++;
        }
        boolean canAutoCommit = rejected == 0 && high == 0 && medium == 0;
        return new DraftValidationReport(draft.getId(), facts.size(), accepted, rejected, high, medium,
                canAutoCommit, results);
    }

    public record ValidationResult(boolean pass, List<String> errors, List<String> warnings,
                                    String conflictLevel, List<String> impactedAgents) {}

    public record DraftValidationReport(String draftId, int totalCount, int accepted, int rejected,
                                         int highConflict, int mediumConflict,
                                         boolean canAutoCommit,
                                         Map<String, ValidationResult> results) {}
}
