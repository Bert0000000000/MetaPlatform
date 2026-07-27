package com.metaplatform.agent.execution;

import com.alibaba.cloud.ai.graph.CompiledGraph;
import com.alibaba.cloud.ai.graph.OverAllState;
import com.alibaba.cloud.ai.graph.StateGraph;
import com.alibaba.cloud.ai.graph.action.AsyncNodeAction;
import com.metaplatform.agent.entity.AgentDefinitionEntity;
import com.metaplatform.agent.entity.AgentStepEntity;
import com.metaplatform.agent.repository.AgentStepRepository;
import io.micrometer.observation.ObservationRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.alibaba.cloud.ai.graph.StateGraph.END;
import static com.alibaba.cloud.ai.graph.StateGraph.START;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaAgentExecutionEngine {

    private final ChatModel chatModel;
    private final ChatClient.Builder chatClientBuilder;
    private final List<ToolCallback> toolCallbacks;
    private final ObservationRegistry observationRegistry;
    private final AgentStepRepository agentStepRepository;

    public ExecutionResult run(AgentDefinitionEntity agent,
                               String tenantId,
                               String task,
                               String context,
                               int maxIterations,
                               String traceId) {
        return executeGraph(agent, tenantId, task, context, maxIterations);
    }

    public ExecutionResult executeReAct(AgentDefinitionEntity agent, String userInput) {
        return executeReAct(agent, agent.getTenantId(), userInput, "");
    }

    public ExecutionResult executeGraph(AgentDefinitionEntity agent, String userInput) {
        return executeGraph(agent, agent.getTenantId(), userInput, "", 10);
    }

    private ExecutionResult executeReAct(AgentDefinitionEntity agent,
                                         String tenantId,
                                         String userInput,
                                         String context) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        String executionId = executionId();
        ChatClient client = chatClientBuilder
                .defaultSystem(agent.getSystemPrompt())
                .defaultToolCallbacks(toolCallbacks)
                .build();
        Prompt prompt = prompt(agent, userInput, context);
        ChatResponse response = client.prompt(prompt).call().chatResponse();
        String output = response == null || response.getResult() == null
                ? "" : response.getResult().getOutput().getText();
        List<ExecutionStep> steps = List.of(
                step(ExecutionStepType.REASONING, "SAA ReAct 推理", output),
                step(ExecutionStepType.FINAL, "最终回答", output));
        persistSteps(executionId, tenantId, steps);
        return result(agent, tenantId, executionId, startedAt, output, steps);
    }

    private ExecutionResult executeGraph(AgentDefinitionEntity agent,
                                         String tenantId,
                                         String userInput,
                                         String context,
                                         int maxIterations) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        String executionId = executionId();
        try {
            StateGraph graph = new StateGraph();
            graph.addNode("plan", AsyncNodeAction.node_async(state -> {
                String input = state.value("input", userInput);
                return Map.of("plan", "Analyze ontology context and answer the request: " + input);
            }));
            graph.addNode("llm", AsyncNodeAction.node_async(state -> {
                String input = state.value("input", userInput);
                String plan = state.value("plan", "");
                Prompt prompt = prompt(agent, input, context + "\n\nExecution plan: " + plan);
                ChatResponse response = chatModel.call(prompt);
                String output = response == null || response.getResult() == null ? "" : response.getResult().getOutput().getText();
                return Map.of("output", output);
            }));
            graph.addNode("review", AsyncNodeAction.node_async(state -> {
                String output = state.value("output", "");
                if (output == null || output.isBlank()) throw new IllegalStateException("graph review rejected empty output");
                return Map.of("validated", true);
            }));
            graph.addEdge(START, "plan");
            graph.addEdge("plan", "llm");
            graph.addEdge("llm", "review");
            graph.addEdge("review", END);
            CompiledGraph compiled = graph.compile();
            // setMaxIterations(int) removed in spring-ai-alibaba 1.1.x; max no longer configurable here
            // compiled.setMaxIterations(maxIterations);
            OverAllState state = compiled.invoke(Map.of("input", userInput))
                    .orElseThrow(() -> new IllegalStateException("SAA Graph 未返回执行状态"));
            String output = state.value("output", "");
            List<ExecutionStep> steps = List.of(
                    step(ExecutionStepType.PLANNING, "SAA StateGraph 编排", "v1.3 R3 Graph Core 执行"),
                    step(ExecutionStepType.REASONING, "SAA Graph 推理", output),
                    step(ExecutionStepType.FINAL, "最终回答", output));
            persistSteps(executionId, tenantId, steps);
            return result(agent, tenantId, executionId, startedAt, output, steps);
        } catch (Exception exception) {
            log.warn("SAA Graph 执行失败，尝试 ChatClient ReAct 路径 | agentId={}", agent.getId(), exception);
            return executeReAct(agent, tenantId, userInput, context);
        }
    }

    private Prompt prompt(AgentDefinitionEntity agent, String input, String context) {
        String systemPrompt = agent.getSystemPrompt();
        if (context != null && !context.isBlank()) {
            systemPrompt += "\n\n附加上下文：" + context;
        }
        return new Prompt(List.of(new SystemMessage(systemPrompt), new UserMessage(input)));
    }

    private void persistSteps(String executionId, String tenantId, List<ExecutionStep> steps) {
        List<AgentStepEntity> entities = new ArrayList<>();
        for (int index = 0; index < steps.size(); index++) {
            ExecutionStep step = steps.get(index);
            AgentStepEntity entity = new AgentStepEntity();
            entity.setId("stp-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            entity.setExecutionId(executionId);
            entity.setTenantId(tenantId);
            entity.setStepType(step.getType().name());
            entity.setContent(step.getContent());
            entity.setSortOrder(index + 1);
            entity.setMetadata("{}");
            entities.add(entity);
        }
        agentStepRepository.saveAll(entities);
    }

    private ExecutionStep step(ExecutionStepType type, String title, String content) {
        return ExecutionStep.builder().type(type).title(title).content(content).build();
    }

    private ExecutionResult result(AgentDefinitionEntity agent,
                                   String tenantId,
                                   String executionId,
                                   OffsetDateTime startedAt,
                                   String output,
                                   List<ExecutionStep> steps) {
        return ExecutionResult.builder()
                .executionId(executionId)
                .agentId(agent.getId())
                .tenantId(tenantId)
                .status(ExecutionStatus.COMPLETED)
                .output(output)
                .steps(steps)
                .modelId(agent.getModelId())
                .startedAt(startedAt)
                .completedAt(OffsetDateTime.now())
                .build();
    }

    private String executionId() {
        return "exe-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
