package com.metaplatform.msg.topics;

/**
 * 平台级 Kafka Topic 集中定义（P0.4.2）。
 *
 * <p>避免 Topic 字符串散落在各业务模块。所有 Ontology / Document / Agent
 * 相关事件统一在这里注册，业务方引用常量而非硬编码。</p>
 */
public final class TopologyTopics {

    private TopologyTopics() {}

    // ============ Ontology 事件（P1 / P7 触发使用） ============

    /** Ontology Concept 定义变更 */
    public static final String ONTOLOGY_CONCEPT_UPDATED   = "ontology.concept.updated";

    /** Ontology Object（业务对象实例）变更 */
    public static final String ONTOLOGY_ENTITY_CHANGED    = "ontology.entity.changed";

    /** Ontology Action 执行完成 */
    public static final String ONTOLOGY_ACTION_EXECUTED   = "ontology.action.executed";

    /** Ontology Commit（草稿发布完成） */
    public static final String ONTOLOGY_COMMIT_PUBLISHED  = "ontology.commit.published";

    /** Ontology 业务事件（外部世界触发） */
    public static final String ONTOLOGY_DOMAIN_EVENT      = "ontology.domain.event";

    // ============ 知识库事件（P2 / P6） ============

    /** 文档上传完成（KB → Agent 抽取触发） */
    public static final String DOCUMENT_UPLOADED          = "kb.document.uploaded";

    /** 文档解析完成 */
    public static final String DOCUMENT_PARSED            = "kb.document.parsed";

    /** 切片入库完成（向量化前） */
    public static final String DOCUMENT_CHUNKED           = "kb.document.chunked";

    /** Candidate Fact 生成（P6 抽取） */
    public static final String DOCUMENT_CANDIDATE_READY   = "kb.document.candidate.ready";

    // ============ Agent 事件（P3 / P4 / P7） ============

    /** AgentRun 状态变化 */
    public static final String AGENT_RUN_STATE_CHANGED    = "agent.run.state.changed";

    /** Claim / Evidence 提交 */
    public static final String AGENT_CLAIM_SUBMITTED      = "agent.claim.submitted";

    /** Action Proposal 提交 */
    public static final String AGENT_ACTION_PROPOSED      = "agent.action.proposed";

    // ============ WFE 事件（P5） ============

    /** Temporal / WFE 工作流事件 */
    public static final String WFE_WORKFLOW_EVENT         = "wfe.workflow.event";

    /** Approval 审批完成 */
    public static final String WFE_APPROVAL_DECIDED       = "wfe.approval.decided";

    /**
     * 全部 Topic 常量集中列表（启动时批量创建）。
     */
    public static final java.util.List<String> ALL = java.util.List.of(
            ONTOLOGY_CONCEPT_UPDATED,
            ONTOLOGY_ENTITY_CHANGED,
            ONTOLOGY_ACTION_EXECUTED,
            ONTOLOGY_COMMIT_PUBLISHED,
            ONTOLOGY_DOMAIN_EVENT,
            DOCUMENT_UPLOADED,
            DOCUMENT_PARSED,
            DOCUMENT_CHUNKED,
            DOCUMENT_CANDIDATE_READY,
            AGENT_RUN_STATE_CHANGED,
            AGENT_CLAIM_SUBMITTED,
            AGENT_ACTION_PROPOSED,
            WFE_WORKFLOW_EVENT,
            WFE_APPROVAL_DECIDED
    );
}
