package com.metaplatform.dialogue.domain;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.conversation.ConversationStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ConversationTest {

    @Test
    void shouldCreateConversation() {
        Conversation conv = Conversation.create("user-1");
        assertNotNull(conv.id());
        assertEquals("user-1", conv.userId());
        assertEquals(ConversationStatus.ACTIVE, conv.status());
        assertTrue(conv.isActive());
        assertNotNull(conv.createdAt());
    }

    @Test
    void shouldCreateWithAnonymousUser() {
        Conversation conv = Conversation.create(null);
        assertEquals("anonymous", conv.userId());
    }

    @Test
    void shouldTransitionToWaiting() {
        Conversation conv = Conversation.create("user-1");
        conv.transitionTo(ConversationStatus.WAITING);
        assertEquals(ConversationStatus.WAITING, conv.status());
        assertTrue(conv.isActive());
    }

    @Test
    void shouldCloseConversation() {
        Conversation conv = Conversation.create("user-1");
        conv.close();
        assertEquals(ConversationStatus.CLOSED, conv.status());
        assertFalse(conv.isActive());
    }

    @Test
    void shouldRejectTransitionFromClosed() {
        Conversation conv = Conversation.create("user-1");
        conv.close();
        assertThrows(IllegalStateException.class,
                () -> conv.transitionTo(ConversationStatus.ACTIVE));
    }

    @Test
    void shouldManageContextVariables() {
        Conversation conv = Conversation.create("user-1");
        conv.setContextVariable("key1", "value1");
        conv.setContextVariable("key2", 42);
        assertEquals("value1", conv.getContextVariable("key1"));
        assertEquals(42, conv.getContextVariable("key2"));
        assertNull(conv.getContextVariable("nonexistent"));
        assertEquals(2, conv.contextVariables().size());
    }

    @Test
    void shouldRejectNullId() {
        assertThrows(NullPointerException.class,
                () -> new Conversation(null, "user-1", java.time.Instant.now()));
    }
}
