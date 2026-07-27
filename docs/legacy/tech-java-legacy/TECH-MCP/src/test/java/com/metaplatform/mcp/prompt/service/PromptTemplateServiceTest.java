package com.metaplatform.mcp.prompt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.prompt.dto.CreatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.dto.PromptTemplateResponse;
import com.metaplatform.mcp.prompt.dto.UpdatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.entity.McpPromptTemplateEntity;
import com.metaplatform.mcp.prompt.repository.McpPromptTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromptTemplateServiceTest {

    @Mock
    private McpPromptTemplateRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private PromptTemplateService service;

    @BeforeEach
    void setUp() {
        service = new PromptTemplateService(repository, objectMapper);
    }

    private McpPromptTemplateEntity sampleEntity() {
        Instant now = Instant.now();
        return McpPromptTemplateEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("greeting")
                .description("Say hello")
                .template("Hello {{name}}, welcome to {{place}}!")
                .variables("[\"name\",\"place\"]")
                .version(1)
                .status("ACTIVE")
                .category("chat")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    void create_template_success() {
        CreatePromptTemplateRequest request = new CreatePromptTemplateRequest();
        request.setName("greeting");
        request.setTemplate("Hello {{name}}!");

        when(repository.save(any(McpPromptTemplateEntity.class))).thenAnswer(inv -> {
            McpPromptTemplateEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        PromptTemplateResponse response = service.create(request);
        assertThat(response.getName()).isEqualTo("greeting");
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
        assertThat(response.getVersion()).isEqualTo(1);
    }

    @Test
    void get_template_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PROMPT_TEMPLATE_NOT_FOUND);
    }

    @Test
    void update_template_increments_version() {
        UUID id = UUID.randomUUID();
        McpPromptTemplateEntity entity = sampleEntity();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(McpPromptTemplateEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdatePromptTemplateRequest request = new UpdatePromptTemplateRequest();
        request.setTemplate("Hi {{name}}!");

        PromptTemplateResponse response = service.update(id, request);
        assertThat(response.getTemplate()).isEqualTo("Hi {{name}}!");
        assertThat(response.getVersion()).isEqualTo(2);
    }

    @Test
    void render_replaces_variables() {
        UUID id = UUID.randomUUID();
        McpPromptTemplateEntity entity = sampleEntity();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        Map<String, Object> result = service.render(id, Map.of("name", "Alice", "place", "Wonderland"));

        assertThat(result.get("rendered")).isEqualTo("Hello Alice, welcome to Wonderland!");
    }

    @Test
    void render_empty_vars_replaces_with_blank() {
        UUID id = UUID.randomUUID();
        McpPromptTemplateEntity entity = sampleEntity();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        Map<String, Object> result = service.render(id, Map.of());
        assertThat(result.get("rendered")).isEqualTo("Hello , welcome to !");
    }

    @Test
    void preview_generates_sample_variables() {
        UUID id = UUID.randomUUID();
        McpPromptTemplateEntity entity = sampleEntity();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        Map<String, Object> result = service.preview(id);
        assertThat(result).containsKey("sampleVariables");
        assertThat(result.get("rendered")).asString().contains("[name]").contains("[place]");
    }

    @Test
    void delete_soft_deletes() {
        UUID id = UUID.randomUUID();
        McpPromptTemplateEntity entity = sampleEntity();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(repository.save(any(McpPromptTemplateEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(id);
        assertThat(entity.getDeletedAt()).isNotNull();
    }
}