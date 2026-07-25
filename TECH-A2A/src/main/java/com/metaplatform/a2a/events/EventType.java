package com.metaplatform.a2a.events;

/**
 * A2A Outbox 事件类型。
 *
 * <p>对应 Python {@code app.events.schemas.EventType}。
 * 这些事件通过 Kafka 发布，供下游消费者（如 TECH-WFE / TECH-AGENT / APP-DASHBOARD）订阅。</p>
 */
public enum EventType {

    /** Agent Card 创建。 */
    CARD_CREATED("card.created"),

    /** Agent Card 更新。 */
    CARD_UPDATED("card.updated"),

    /** Agent Card 删除。 */
    CARD_DELETED("card.deleted"),

    /** Agent 注册。 */
    AGENT_REGISTERED("agent.registered"),

    /** Agent 注销。 */
    AGENT_DEREGISTERED("agent.deregistered"),

    /** 委派任务状态变更。 */
    TASK_STATUS_CHANGED("task.status_changed"),

    /** Agent 间消息发送。 */
    MESSAGE_SENT("message.sent");

    private final String code;

    EventType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
