package com.metaplatform.dialogue.interfaces.rest;

import com.metaplatform.dialogue.application.*;
import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationRepository;
import com.metaplatform.dialogue.domain.message.MessageRepository;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryConversationRepository;
import com.metaplatform.dialogue.infrastructure.memory.InMemoryMessageRepository;
import com.metaplatform.dialogue.infrastructure.parser.SimplePatternNLParser;
import com.metaplatform.dialogue.infrastructure.parser.TemplateResponseGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ConversationController.class)
class ConversationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private ObjectMapper objectMapper;

    @TestConfiguration
    static class TestConfig {
        @Bean
        public ConversationRepository conversationRepository() {
            return new InMemoryConversationRepository();
        }

        @Bean
        public MessageRepository messageRepository() {
            return new InMemoryMessageRepository();
        }

        @Bean
        public NaturalLanguageParser nlParser() {
            return new SimplePatternNLParser();
        }

        @Bean
        public ResponseGenerator responseGenerator() {
            return new TemplateResponseGenerator();
        }

        @Bean
        public ContextManager contextManager(ConversationRepository convRepo, MessageRepository msgRepo) {
            return new ContextManager(convRepo, msgRepo);
        }

        @Bean
        public ConversationService conversationService(
                ConversationRepository convRepo,
                NaturalLanguageParser parser,
                ResponseGenerator generator,
                ContextManager contextManager) {
            return new ConversationService(convRepo, parser, generator, contextManager);
        }
    }

    @Test
    void shouldCreateConversation() throws Exception {
        mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value("user-1"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    void shouldCreateConversationWithDefaultUser() throws Exception {
        mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value("anonymous"));
    }

    @Test
    void shouldSendMessage() throws Exception {
        // Create conversation first
        String response = mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andReturn().getResponse().getContentAsString();

        String convId = objectMapper.readTree(response).get("id").asText();

        mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"查询客户\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ASSISTANT"))
                .andExpect(jsonPath("$.content").isNotEmpty());
    }

    @Test
    void shouldReturn404ForNonexistentConversation() throws Exception {
        mockMvc.perform(get("/api/v1/conversations/nonexistent"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldListConversations() throws Exception {
        mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void shouldGetMessages() throws Exception {
        String response = mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andReturn().getResponse().getContentAsString();

        String convId = objectMapper.readTree(response).get("id").asText();

        mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"帮助\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/conversations/" + convId + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void shouldCloseConversation() throws Exception {
        String response = mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andReturn().getResponse().getContentAsString();

        String convId = objectMapper.readTree(response).get("id").asText();

        mockMvc.perform(post("/api/v1/conversations/" + convId + "/close"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/conversations/" + convId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void shouldExportConversation() throws Exception {
        String response = mockMvc.perform(post("/api/v1/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"user-1\"}"))
                .andReturn().getResponse().getContentAsString();

        String convId = objectMapper.readTree(response).get("id").asText();

        mockMvc.perform(get("/api/v1/conversations/" + convId + "/export"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversation").exists())
                .andExpect(jsonPath("$.messages").isArray());
    }
}
