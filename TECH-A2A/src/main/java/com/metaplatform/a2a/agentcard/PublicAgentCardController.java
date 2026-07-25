package com.metaplatform.a2a.agentcard;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * A2A 协议公开端点。
 *
 * <p>对应 Python {@code app.api.v1.public}。
 * 暴露 {@code .well-known/agent.json} 与按 name 查询的公开 Card 端点，
 * 用于 A2A 协议兼容的 Agent 发现。</p>
 */
@RestController
@RequestMapping("/.well-known")
@RequiredArgsConstructor
public class PublicAgentCardController {

    private final AgentCardService cardService;

    /**
     * 按 name 查询已发布的 Agent Card（A2A 协议公开端点）。
     *
     * <p>路径示例：{@code /.well-known/agents/{name}}。
     * 返回符合 A2A 协议的 Agent Card JSON。</p>
     */
    @GetMapping(value = "/agents/{name}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getPublicCard(@PathVariable String name) {
        // 不使用 ApiResponse 包裹，直接返回 A2A 协议 Card 格式
        return cardService.findPublicByName(name);
    }

    /**
     * 默认 Agent Card（根级 .well-known/agent.json）。
     */
    @GetMapping(value = "/agent.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getDefaultCard() {
        // 返回平台默认 Card（可用 application.yml 配置覆盖）
        return cardService.findPublicByName("default");
    }
}
