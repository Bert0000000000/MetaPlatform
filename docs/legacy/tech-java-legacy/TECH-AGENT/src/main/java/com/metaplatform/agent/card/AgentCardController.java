package com.metaplatform.agent.card;

import com.metaplatform.agent.card.dto.AgentCardResponse;
import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent Card 生成端点（A2A 兼容）。
 *
 * <p>对应 Python {@code app.api.v1.card}。挂在 {@code /api/v1/agent/agents/{agentId}/card} 路径下。</p>
 */
@RestController
@RequestMapping("/api/v1/agent/agents")
@RequiredArgsConstructor
public class AgentCardController {

    private final AgentCardService agentCardService;

    @GetMapping("/{agentId}/card")
    public ApiResponse<AgentCardResponse> generateCard(@PathVariable String agentId) {
        AgentCardResponse card = agentCardService.generateCard(
                TenantContext.getTenantIdOrDefault(), agentId);
        return ApiResponse.success(card);
    }
}
