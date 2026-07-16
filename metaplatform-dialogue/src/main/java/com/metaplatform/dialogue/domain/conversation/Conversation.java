package com.metaplatform.dialogue.domain.conversation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 会话聚合根。管理会话的生命周期和上下文变量。
 */
public class Conversation {
    private final ConversationId id;
    private final String userId;
    private final Instant createdAt;
    private ConversationStatus status;
    private Instant updatedAt;
    private final Map<String, Object> contextVariables;

    public Conversation(ConversationId id, String userId, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.userId = userId != null ? userId : "anonymous";
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
        this.updatedAt = this.createdAt;
        this.status = ConversationStatus.ACTIVE;
        this.contextVariables = new ConcurrentHashMap<>();
    }

    public static Conversation create(String userId) {
        return new Conversation(ConversationId.newId(), userId, Instant.now());
    }

    public ConversationId id() { return id; }
    public String userId() { return userId; }
    public ConversationStatus status() { return status; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }
    public Map<String, Object> contextVariables() { return Map.copyOf(contextVariables); }

    /**
     * 更新会话状态。
     */
    public void transitionTo(ConversationStatus newStatus) {
        if (this.status == ConversationStatus.CLOSED) {
            throw new IllegalStateException("Cannot transition a closed conversation");
        }
        this.status = newStatus;
        this.updatedAt = Instant.now();
    }

    /**
     * 设置上下文变量。
     */
    public void setContextVariable(String key, Object value) {
        Objects.requireNonNull(key, "key");
        contextVariables.put(key, value);
        this.updatedAt = Instant.now();
    }

    /**
     * 获取上下文变量。
     */
    public Object getContextVariable(String key) {
        return contextVariables.get(key);
    }

    /**
     * 关闭会话。
     */
    public void close() {
        this.status = ConversationStatus.CLOSED;
        this.updatedAt = Instant.now();
    }

    /**
     * 检查会话是否仍处于活跃状态。
     */
    public boolean isActive() {
        return status == ConversationStatus.ACTIVE || status == ConversationStatus.WAITING;
    }
}
