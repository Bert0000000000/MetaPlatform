package com.metaplatform.agent.extraction;

import com.metaplatform.agent.deerflow.DeerFlowAdapter;
import com.metaplatform.agent.deerflow.DeerFlowAdapter.StartRunRequest;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.consumer.EventTopicListener;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 文档抽取触发器（P6.1）。
 *
 * <p>订阅 {@code kb.document.uploaded} 事件，调用 DeerFlow 启动 Extraction Run。
 * DeerFlow 拆 4 个内置 Sub-Agent：合同 / 联系人 / 风险 / 时间线，
 * 输出 CandidateFact 列表，由 P1.3 的 OntologyDraftService 入库。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentExtractionTrigger {

    private final DeerFlowAdapter deerFlowAdapter;

    @EventTopicListener(
            topics = TopologyTopics.DOCUMENT_UPLOADED,
            group = "agent-extractor",
            concurrency = 2,
            retries = 3,
            dlq = true
    )
    public void onDocumentUploaded(EventEnvelope<Map<String, Object>> envelope) {
        Map<String, Object> payload = envelope.payload();
        Object docId = payload == null ? null : payload.get("id");
        Object kbId = payload == null ? null : payload.get("kbId");
        Object tenantId = payload == null ? null : payload.get("tenantId");

        log.info("[DocumentExtractionTrigger] onDocumentUploaded docId={} kbId={} tenant={}",
                docId, kbId, tenantId);

        Map<String, Object> ontologyEnvelope = Map.of(
                "envelopeId", "ENV-" + UUID.randomUUID(),
                "tenantId", String.valueOf(tenantId == null ? "tenant-default" : tenantId),
                "subject", Map.of(
                        "conceptCode", "Document",
                        "objectId", String.valueOf(docId)
                )
        );

        StartRunRequest req = StartRunRequest.builder()
                .tenantId(String.valueOf(tenantId == null ? "tenant-default" : tenantId))
                .userId("system-extractor")
                .agentId("document-extractor")
                .threadId("doc-" + docId)
                .message("请抽取文档 " + docId + " 中的业务事实，输出 Candidate Fact 列表")
                .ontologyEnvelope(ontologyEnvelope)
                .allowedTools(List.of(
                        "ontology.describe_concept",
                        "ontology.search_objects",
                        "ontology.create_candidate_fact",
                        "rag.search"
                ))
                .build();
        String runId = deerFlowAdapter.startRun(req);
        log.info("[DocumentExtractionTrigger] deerflow runId={} for docId={}", runId, docId);
    }
}
