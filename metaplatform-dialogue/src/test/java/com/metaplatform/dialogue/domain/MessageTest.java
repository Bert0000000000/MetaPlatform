package com.metaplatform.dialogue.domain;

import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.domain.message.MessageRole;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class MessageTest {

    @Test
    void shouldCreateUserMessage() {
        ConversationId convId = ConversationId.newId();
        Message msg = Message.createUserMessage(convId, "Hello");
        assertNotNull(msg.id());
        assertEquals(convId, msg.conversationId());
        assertEquals(MessageRole.USER, msg.role());
        assertEquals("Hello", msg.content());
        assertTrue(msg.isFromUser());
        assertFalse(msg.isFromAssistant());
    }

    @Test
    void shouldCreateAssistantMessage() {
        ConversationId convId = ConversationId.newId();
        Message msg = Message.createAssistantMessage(convId, "Hi there");
        assertEquals(MessageRole.ASSISTANT, msg.role());
        assertTrue(msg.isFromAssistant());
    }

    @Test
    void shouldCreateSystemMessage() {
        ConversationId convId = ConversationId.newId();
        Message msg = Message.createSystemMessage(convId, "System notice");
        assertEquals(MessageRole.SYSTEM, msg.role());
        assertFalse(msg.isFromUser());
        assertFalse(msg.isFromAssistant());
    }

    @Test
    void shouldRejectBlankContent() {
        ConversationId convId = ConversationId.newId();
        assertThrows(IllegalArgumentException.class,
                () -> Message.createUserMessage(convId, ""));
        assertThrows(IllegalArgumentException.class,
                () -> Message.createUserMessage(convId, null));
        assertThrows(IllegalArgumentException.class,
                () -> Message.createUserMessage(convId, "   "));
    }

    @Test
    void shouldHaveDefaultEmptyMetadata() {
        ConversationId convId = ConversationId.newId();
        Message msg = Message.createUserMessage(convId, "test");
        assertTrue(msg.metadata().isEmpty());
    }
}
