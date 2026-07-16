package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.conversation.ConversationRepository;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.domain.message.MessageRepository;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryConversationRepository;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryMessageRepository;
import com.metaplatform.dialogue.infrastructure.parser.SimplePatternNLParser;
import com.metaplatform.dialogue.infrastructure.parser.TemplateResponseGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ConversationServiceTest {

    private ConversationService conversationService;
    private ConversationRepository conversationRepository;
    private MessageRepository messageRepository;

    @BeforeEach
    void setUp() {
        conversationRepository = new InMemoryConversationRepository();
        messageRepository = new InMemoryMessageRepository();
        NaturalLanguageParser parser = new SimplePatternNLParser();
        ResponseGenerator responseGenerator = new TemplateResponseGenerator();
        ContextManager contextManager = new ContextManager(conversationRepository, messageRepository);
        conversationService = new ConversationService(
                conversationRepository, parser, responseGenerator, contextManager);
    }

    @Test
    void shouldCreateConversation() {
        Conversation conv = conversationService.createConversation("user-1");
        assertNotNull(conv.id());
        assertEquals("user-1", conv.userId());
    }

    @Test
    void shouldSendMessageAndReceiveReply() {
        Conversation conv = conversationService.createConversation("user-1");
        Message reply = conversationService.sendMessage(conv.id(), "查询所有客户");

        assertNotNull(reply);
        assertTrue(reply.isFromAssistant());
        assertNotNull(reply.content());
        assertFalse(reply.content().isBlank());
    }

    @Test
    void shouldSendMessageAndParseQueryIntent() {
        Conversation conv = conversationService.createConversation("user-1");
        Message reply = conversationService.sendMessage(conv.id(), "查询所有客户");

        // 回复应包含"查询"相关的内容
        assertTrue(reply.content().contains("查询") || reply.content().contains("正在"));
    }

    @Test
    void shouldSendMessageAndParseCreateIntent() {
        Conversation conv = conversationService.createConversation("user-1");
        Message reply = conversationService.sendMessage(conv.id(), "创建一个新客户");

        assertTrue(reply.content().contains("创建") || reply.content().contains("正在"));
    }

    @Test
    void shouldSendMessageAndParseHelpIntent() {
        Conversation conv = conversationService.createConversation("user-1");
        Message reply = conversationService.sendMessage(conv.id(), "帮助");

        assertNotNull(reply.content());
        assertFalse(reply.content().isBlank());
    }

    @Test
    void shouldSendMessageAndHandleUnknownIntent() {
        Conversation conv = conversationService.createConversation("user-1");
        Message reply = conversationService.sendMessage(conv.id(), "xyzzy foobar");

        assertNotNull(reply.content());
        assertTrue(reply.content().contains("无法理解") || reply.content().contains("抱歉"));
    }

    @Test
    void shouldTrackMessageHistory() {
        Conversation conv = conversationService.createConversation("user-1");
        conversationService.sendMessage(conv.id(), "查询客户");
        conversationService.sendMessage(conv.id(), "创建订单");

        List<Message> messages = conversationService.getMessages(conv.id());
        // 至少4条：2条用户消息 + 2条回复
        assertTrue(messages.size() >= 4);
    }

    @Test
    void shouldCloseConversation() {
        Conversation conv = conversationService.createConversation("user-1");
        conversationService.closeConversation(conv.id());

        Conversation closed = conversationService.getConversation(conv.id());
        assertFalse(closed.isActive());
    }

    @Test
    void shouldRejectMessageOnClosedConversation() {
        Conversation conv = conversationService.createConversation("user-1");
        conversationService.closeConversation(conv.id());

        assertThrows(IllegalStateException.class,
                () -> conversationService.sendMessage(conv.id(), "test"));
    }

    @Test
    void shouldExportConversation() {
        Conversation conv = conversationService.createConversation("user-1");
        conversationService.sendMessage(conv.id(), "查询客户");

        Map<String, Object> exported = conversationService.exportConversation(conv.id());
        assertNotNull(exported);
        assertTrue(exported.containsKey("conversation"));
        assertTrue(exported.containsKey("messages"));
        assertTrue(exported.containsKey("messageCount"));
    }

    @Test
    void shouldFindConversationsByUserId() {
        conversationService.createConversation("user-1");
        conversationService.createConversation("user-1");
        conversationService.createConversation("user-2");

        List<Conversation> user1Convs = conversationService.getUserConversations("user-1");
        assertEquals(2, user1Convs.size());
    }
}
