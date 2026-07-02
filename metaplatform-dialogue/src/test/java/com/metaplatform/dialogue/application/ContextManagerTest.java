package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryConversationRepository;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ContextManagerTest {

    private ContextManager contextManager;
    private InMemoryMessageRepository messageRepository;

    @BeforeEach
    void setUp() {
        InMemoryConversationRepository conversationRepository = new InMemoryConversationRepository();
        messageRepository = new InMemoryMessageRepository();
        contextManager = new ContextManager(conversationRepository, messageRepository);
    }

    @Test
    void shouldAddAndRetrieveMessages() {
        ConversationId convId = ConversationId.newId();
        Message msg1 = Message.createUserMessage(convId, "Hello");
        Message msg2 = Message.createAssistantMessage(convId, "Hi");

        contextManager.addMessage(msg1);
        contextManager.addMessage(msg2);

        List<Message> history = contextManager.getMessageHistory(convId);
        assertEquals(2, history.size());
    }

    @Test
    void shouldReturnMessagesInOrder() {
        ConversationId convId = ConversationId.newId();
        Message msg1 = Message.createUserMessage(convId, "First");
        Message msg2 = Message.createAssistantMessage(convId, "Second");
        Message msg3 = Message.createUserMessage(convId, "Third");

        contextManager.addMessage(msg1);
        contextManager.addMessage(msg2);
        contextManager.addMessage(msg3);

        List<Message> history = contextManager.getMessageHistory(convId);
        assertEquals("First", history.get(0).content());
        assertEquals("Second", history.get(1).content());
        assertEquals("Third", history.get(2).content());
    }

    @Test
    void shouldReturnEmptyListForNewConversation() {
        ConversationId convId = ConversationId.newId();
        List<Message> history = contextManager.getMessageHistory(convId);
        assertTrue(history.isEmpty());
    }

    @Test
    void shouldGetRecentMessages() {
        ConversationId convId = ConversationId.newId();
        for (int i = 0; i < 10; i++) {
            contextManager.addMessage(Message.createUserMessage(convId, "msg-" + i));
        }
        List<Message> recent = contextManager.getRecentMessages(convId, 3);
        assertEquals(3, recent.size());
        assertEquals("msg-7", recent.get(0).content());
        assertEquals("msg-9", recent.get(2).content());
    }

    @Test
    void shouldUpdateContext() {
        Conversation conv = Conversation.create("user-1");
        InMemoryConversationRepository conversationRepository = new InMemoryConversationRepository();
        ContextManager cm = new ContextManager(conversationRepository, messageRepository);

        cm.updateContext(conv, "key1", "value1");
        assertEquals("value1", conv.getContextVariable("key1"));
    }
}
