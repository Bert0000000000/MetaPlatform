package com.metaplatform.dialogue.domain.message;

import com.metaplatform.dialogue.domain.conversation.ConversationId;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

/**
 * 消息实体。代表对话中的一条消息。
 */
public class Message {
    private final MessageId id;
    private final ConversationId conversationId;
    private final MessageRole role;
    private final String content;
    private final Instant timestamp;
    private final Map<String, Object> metadata;

    public Message(MessageId id, ConversationId conversationId, MessageRole role,
                   String content, Instant timestamp, Map<String, Object> metadata) {
        this.id = Objects.requireNonNull(id, "id");
        this.conversationId = Objects.requireNonNull(conversationId, "conversationId");
        this.role = Objects.requireNonNull(role, "role");
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Message content must not be blank");
        }
        this.content = content;
        this.timestamp = Objects.requireNonNull(timestamp, "timestamp");
        this.metadata = metadata != null ? Map.copyOf(metadata) : Map.of();
    }

    public static Message createUserMessage(ConversationId conversationId, String content) {
        return new Message(MessageId.newId(), conversationId, MessageRole.USER,
                content, Instant.now(), null);
    }

    public static Message createAssistantMessage(ConversationId conversationId, String content) {
        return new Message(MessageId.newId(), conversationId, MessageRole.ASSISTANT,
                content, Instant.now(), null);
    }

    public static Message createSystemMessage(ConversationId conversationId, String content) {
        return new Message(MessageId.newId(), conversationId, MessageRole.SYSTEM,
                content, Instant.now(), null);
    }

    public MessageId id() { return id; }
    public ConversationId conversationId() { return conversationId; }
    public MessageRole role() { return role; }
    public String content() { return content; }
    public Instant timestamp() { return timestamp; }
    public Map<String, Object> metadata() { return metadata; }

    public boolean isFromUser() { return role == MessageRole.USER; }
    public boolean isFromAssistant() { return role == MessageRole.ASSISTANT; }
}
