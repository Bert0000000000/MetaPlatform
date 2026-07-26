package com.metaplatform.msg.topology;

/**
 * Backward-compatibility re-export shim.
 *
 * <p>历史代码使用 {@code com.metaplatform.msg.topology.TopologyTopics}，
 * 实际类在 {@code com.metaplatform.msg.topics.TopologyTopics}。
 * 本 shim 保证 {@code import com.metaplatform.msg.topology.TopologyTopics}
 * 仍可编译通过。</p>
 */
public final class TopologyTopics {
    private TopologyTopics() {}

    public static final String ONTOLOGY_CONCEPT_UPDATED   = com.metaplatform.msg.topics.TopologyTopics.ONTOLOGY_CONCEPT_UPDATED;
    public static final String ONTOLOGY_ENTITY_CHANGED    = com.metaplatform.msg.topics.TopologyTopics.ONTOLOGY_ENTITY_CHANGED;
    public static final String ONTOLOGY_ACTION_EXECUTED   = com.metaplatform.msg.topics.TopologyTopics.ONTOLOGY_ACTION_EXECUTED;
    public static final String ONTOLOGY_COMMIT_PUBLISHED  = com.metaplatform.msg.topics.TopologyTopics.ONTOLOGY_COMMIT_PUBLISHED;
    public static final String ONTOLOGY_DOMAIN_EVENT      = com.metaplatform.msg.topics.TopologyTopics.ONTOLOGY_DOMAIN_EVENT;
    public static final String DOCUMENT_UPLOADED          = com.metaplatform.msg.topics.TopologyTopics.DOCUMENT_UPLOADED;
    public static final String DOCUMENT_PARSED            = com.metaplatform.msg.topics.TopologyTopics.DOCUMENT_PARSED;
    public static final String DOCUMENT_CHUNKED           = com.metaplatform.msg.topics.TopologyTopics.DOCUMENT_CHUNKED;
    public static final String DOCUMENT_CANDIDATE_READY   = com.metaplatform.msg.topics.TopologyTopics.DOCUMENT_CANDIDATE_READY;
    public static final String AGENT_RUN_STATE_CHANGED    = com.metaplatform.msg.topics.TopologyTopics.AGENT_RUN_STATE_CHANGED;
    public static final String AGENT_CLAIM_SUBMITTED      = com.metaplatform.msg.topics.TopologyTopics.AGENT_CLAIM_SUBMITTED;
    public static final String AGENT_ACTION_PROPOSED      = com.metaplatform.msg.topics.TopologyTopics.AGENT_ACTION_PROPOSED;
    public static final String WFE_WORKFLOW_EVENT         = com.metaplatform.msg.topics.TopologyTopics.WFE_WORKFLOW_EVENT;
    public static final String WFE_APPROVAL_DECIDED       = com.metaplatform.msg.topics.TopologyTopics.WFE_APPROVAL_DECIDED;
    public static final java.util.List<String> ALL         = com.metaplatform.msg.topics.TopologyTopics.ALL;
}