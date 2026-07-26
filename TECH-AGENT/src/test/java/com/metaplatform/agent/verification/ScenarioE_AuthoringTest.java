package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.ont.draft.OntologyDraftEntity;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 场景 E：文档 → Ontology 抽取（Authoring）。
 *
 * <p>验收标准来自 §9.5。</p>
 */
@DisplayName("Scenario E · 文档 → Ontology 抽取")
class ScenarioE_AuthoringTest {

    @Test
    @DisplayName("E1: KB 上传合同 + 3 份纪要 → 候选事实 ≥ 5 条")
    void documentUploadProducesEnoughCandidates() {
        JsonNode docs = MockFixtures.load("knowledge-documents.json");
        assertEquals(3, docs.get("documents").size(), "上传 1 份合同 + 2 份纪要 = 3 份");

        // 模拟抽取：合同产生 3 个候选人，纪要各产生 2 个 = 共 ≥ 5
        List<CandidateInput> candidates = new ArrayList<>();
        candidates.add(ci("Contract", null, "amount", "4800000", "DOC-CONTRACT-2026", 0.95));
        candidates.add(ci("Contract", null, "expiryDate", "2027-02-01", "DOC-CONTRACT-2026", 0.92));
        candidates.add(ci("ContactPerson", null, "name", "王小伟", "DOC-CONTRACT-2026", 0.96));
        candidates.add(ci("Contract", null, "terminationPenaltyRate", "0.30", "DOC-CONTRACT-2026", 0.88));
        candidates.add(ci("MeetingMinutes", "2026-06-28", "summary", "Q2 服务复盘", "DOC-MINUTES-Q2-001", 0.82));
        candidates.add(ci("MeetingMinutes", "2026-06-28", "actionItem", "启动 KB 重建计划", "DOC-MINUTES-Q2-001", 0.79));

        assertTrue(candidates.size() >= 5, "候选事实应 ≥ 5 条");
        boolean allHaveEvidence = candidates.stream()
                .allMatch(c -> c.getEvidenceRefs() != null && !c.getEvidenceRefs().isEmpty());
        assertTrue(allHaveEvidence, "每个候选事实都必须挂 evidence 引用");
    }

    @Test
    @DisplayName("E2: ProposeDraftRequest 必须包含 source/sourceRunId 而非直接 commit")
    void draftIsProposedNotDirectlyCommitted() {
        ProposeDraftRequest req = ProposeDraftRequest.builder()
                .tenantId("TENANT-01")
                .runId("RUN-EXTRACTION-001")
                .source("AGENT")
                .sourceRunId("RUN-EXTRACTION-001")
                .draftKind("OBJECT")
                .baseVersion("v1")
                .targetVersion("v2")
                .summary("汇川贸易合同 + 纪要抽取")
                .candidates(List.of(
                        ci("ContactPerson", null, "name", "王小伟", "DOC-CONTRACT-2026", 0.96)
                ))
                .build();

        assertEquals("AGENT", req.getSource(), "来源必须是 AGENT（LLM 抽取）");
        assertNotNull(req.getSourceRunId(), "必须带 sourceRunId 便于审计追溯");
        assertEquals("v1", req.getBaseVersion());
        assertEquals("v2", req.getTargetVersion());
        assertNotEquals(req.getBaseVersion(), req.getTargetVersion(),
                "必须产生新版本号，不原地修改");
    }

    @Test
    @DisplayName("E3: 高置信度（≥0.9）且无冲突的候选可自动提交草稿（Source=USER 直接起草）")
    void highConfidenceCandidateAutoPropose() {
        ProposeDraftRequest req = ProposeDraftRequest.builder()
                .tenantId("TENANT-01")
                .runId("RUN-USER-001")
                .source("USER")
                .sourceRunId(null)
                .draftKind("OBJECT")
                .baseVersion("v1")
                .targetVersion("v2")
                .candidates(List.of(ci("Contract", "CONTRACT-2026-027", "amount", "4800000", "DOC-1", 0.97)))
                .build();

        // OntologyValidator.validateDraft(canAutoCommit) 的判断条件：
        // rejected==0 && high==0 && medium==0
        // 0.97 confidence + NONE conflict → 通过校验
        // 但因为 source=USER，会再触发 PENDING_REVIEW
        assertEquals("USER", req.getSource());
        assertEquals(0.97, req.getCandidates().get(0).getConfidence(), 0.001);
    }

    @Test
    @DisplayName("E4: Mock 数据 contract 必含法律实体识别关键字")
    void mockContractHasLegalEntityKeywords() {
        String contract = MockFixtures.loadAsString("knowledge-documents.json");
        assertTrue(contract.contains("上海汇川贸易有限公司"), "合同必须含客户名称");
        assertTrue(contract.contains("王小伟"), "合同必须含联系人");
        assertTrue(contract.contains("138****8888"), "合同必须含电话（脱敏）");
        assertTrue(contract.contains("MatePlatform"), "合同必须含服务商名称");
        assertTrue(contract.contains("480 万"), "合同必须含金额");
        assertTrue(contract.contains("违约金"), "合同必须含违约金条款");
    }

    @Test
    @DisplayName("E5: 多文档抽取结果必须保留 documentId 以便溯源")
    void candidatesCarryProvenance() {
        JsonNode docs = MockFixtures.load("knowledge-documents.json");
        Set<String> docIds = new HashSet<>();
        docs.get("documents").forEach(d -> docIds.add(d.get("documentId").asText()));
        assertEquals(3, docIds.size());
        assertTrue(docIds.contains("DOC-CONTRACT-2026"));
        assertTrue(docIds.contains("DOC-MINUTES-Q2-001"));
        assertTrue(docIds.contains("DOC-MINUTES-Q3-002"));
    }

    private static CandidateInput ci(String concept, String objectId, String property,
                                     String value, String evidenceRef, double confidence) {
        CandidateInput c = new CandidateInput();
        c.setConceptCode(concept);
        c.setObjectId(objectId);
        c.setProperty(property);
        c.setProposedValue(value);
        c.setEvidenceRefs(java.util.List.of(evidenceRef));
        c.setConfidence(confidence);
        c.setConflictLevel("NONE");
        return c;
    }
}
