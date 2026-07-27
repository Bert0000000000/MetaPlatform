package com.metaplatform.kb.service;

import com.metaplatform.kb.entity.*;
import com.metaplatform.kb.repository.*;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 知识库主服务（P2.1.2 / P2.1.3）。
 *
 * <p>负责：</p>
 * <ul>
 *   <li>KB CRUD + 版本快照</li>
 *   <li>文档上传 → MinIO key 生成 → 触发 {@code DOCUMENT_UPLOADED} 事件</li>
 *   <li>绑定管理（Agent / Object / Page）</li>
 *   <li>检索配置管理</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KbService {

    private final KbRepository kbRepository;
    private final KbDocumentRepository documentRepository;
    private final KbChunkStrategyRepository strategyRepository;
    private final KbBindingRepository bindingRepository;
    private final KbRetrievalConfigRepository retrievalConfigRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    // ============ KB CRUD ============

    @Transactional
    public KbEntity createKb(KbEntity entity) {
        entity.setId("KB-" + UUID.randomUUID());
        entity.setVersion(1);
        entity.setDeleted(false);
        entity.setEnabled(true);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        if (entity.getKbKind() == null) entity.setKbKind("GENERAL");
        if (entity.getEmbeddingModel() == null) entity.setEmbeddingModel("text-embedding-v3");
        if (entity.getVectorDim() == 0) entity.setVectorDim(1024);
        return kbRepository.save(entity);
    }

    public List<KbEntity> listKb(String tenantId) {
        return kbRepository.findByTenantIdAndDeletedFalse(tenantId);
    }

    public KbEntity getKb(String id) {
        return kbRepository.findById(id).orElseThrow();
    }

    @Transactional
    public KbEntity updateKb(String id, KbEntity patch) {
        KbEntity e = getKb(id);
        if (patch.getDisplayName() != null) e.setDisplayName(patch.getDisplayName());
        if (patch.getDescription() != null) e.setDescription(patch.getDescription());
        if (patch.getEmbeddingModel() != null) e.setEmbeddingModel(patch.getEmbeddingModel());
        e.setEnabled(patch.isEnabled());
        e.setVersion(e.getVersion() + 1);
        e.setUpdatedAt(Instant.now());
        return kbRepository.save(e);
    }

    @Transactional
    public void deleteKb(String id) {
        KbEntity e = getKb(id);
        e.setDeleted(true);
        e.setUpdatedAt(Instant.now());
        kbRepository.save(e);
    }

    // ============ 文档上传 + 触发（P2.1.3） ============

    /**
     * 上传文档：仅元数据落库 + MinIO key，文件实际由前端 / K8s 直传。
     * 落库后立即触发 Kafka {@link TopologyTopics#DOCUMENT_UPLOADED} 事件，
     * 由 Extraction Agent（Phase 6）/ Embedding Worker（Phase 2.2）异步消费。
     */
    @Transactional
    public KbDocumentEntity uploadDocument(KbDocumentEntity doc) {
        doc.setId("DOC-" + UUID.randomUUID());
        doc.setVersion(1);
        doc.setDeleted(false);
        doc.setStatus("UPLOADED");
        doc.setCreatedAt(Instant.now());
        doc.setUpdatedAt(Instant.now());
        KbDocumentEntity saved = documentRepository.save(doc);
        // 触发异步处理
        kafkaTemplate.send(TopologyTopics.DOCUMENT_UPLOADED, saved.getId(), saved);
        log.info("[KbService] uploaded documentId={} kbId={}", saved.getId(), saved.getKbId());
        return saved;
    }

    public List<KbDocumentEntity> listDocuments(String kbId) {
        return documentRepository.findByKbIdAndDeletedFalse(kbId);
    }

    public KbDocumentEntity getDocument(String id) {
        return documentRepository.findByIdAndDeletedFalse(id).orElseThrow();
    }

    /**
     * 触发文档处理流水线（解析 → 切片 → 向量化）。
     * 实际处理由 Phase 2.1.4 Chunker 与 Phase 2.2 Embedding Worker 异步执行。
     */
    @Transactional
    public KbDocumentEntity triggerProcess(String documentId) {
        KbDocumentEntity doc = getDocument(documentId);
        doc.setStatus("PARSING");
        doc.setUpdatedAt(Instant.now());
        KbDocumentEntity saved = documentRepository.save(doc);
        kafkaTemplate.send(TopologyTopics.DOCUMENT_PARSED, saved.getId(), saved);
        return saved;
    }

    // ============ 绑定 / 检索配置 ============

    @Transactional
    public KbBindingEntity createBinding(KbBindingEntity b) {
        b.setId("BND-" + UUID.randomUUID());
        b.setEnabled(true);
        b.setCreatedAt(Instant.now());
        return bindingRepository.save(b);
    }

    public List<KbBindingEntity> findBindings(String tenantId, String bindType, String bindKey) {
        return bindingRepository.findByTenantIdAndBindTypeAndBindKeyAndEnabledTrue(tenantId, bindType, bindKey);
    }

    @Transactional
    public KbRetrievalConfigEntity upsertRetrievalConfig(KbRetrievalConfigEntity cfg) {
        cfg.setUpdatedAt(Instant.now());
        if (cfg.getId() == null) cfg.setId("CFG-" + UUID.randomUUID());
        if (cfg.getTopK() == 0) cfg.setTopK(8);
        if (cfg.getThreshold() == 0) cfg.setThreshold(0.6);
        if (cfg.getHybridAlpha() == 0) cfg.setHybridAlpha(0.5);
        return retrievalConfigRepository.save(cfg);
    }

    public KbRetrievalConfigEntity getRetrievalConfig(String tenantId, String kbId) {
        return retrievalConfigRepository.findByTenantIdAndKbId(tenantId, kbId).orElse(null);
    }
}
