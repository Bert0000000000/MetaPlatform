package com.metaplatform.agent.extraction;

import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.consumer.EventTopicListener;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;

/**
 * Candidate Fact Ready 监听器（P6.1 收口）。
 *
 * <p>订阅 {@code kb.document.candidate.ready} 事件，把 DeerFlow 抽取出的候选事实
 * 写入 Ontology Draft。Draft 状态机由 P1.3 OntologyDraftService 管理。</p>
 */
@Slf4j
@Service
public class DocumentCandidateListener {

    private final OntologyDraftService draftService;

    @Autowired
    public DocumentCandidateListener(@Autowired(required = false) OntologyDraftService draftService) { this.draftService = draftService; }

    @EventTopicListener(
            topics = TopologyTopics.DOCUMENT_CANDIDATE_READY,
            group = "ont-draft-writer",
            concurrency = 1,
            retries = 3,
            dlq = true
    )
    public void onCandidateReady(EventEnvelope<Map<String, Object>> envelope) {
        Map<String, Object> payload = envelope.payload();
        log.info("[DocumentCandidateListener] onCandidateReady payload-keys={}",
                payload == null ? "null" : payload.keySet());
        // P6.1 占位：实际由 TECH-ONT OntologyDraftService.proposeDraft 处理
        // 此处只做事件转发，不重复解析
    }
}
