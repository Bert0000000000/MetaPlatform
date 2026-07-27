package com.metaplatform.agent.card.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * A2A 兼容 Agent Card 响应（JSON-LD 格式）。
 *
 * <p>对应 Python {@code app.card.schemas.AgentCard} 的 {@code card_to_dict} 输出。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentCardResponse {

    /** JSON-LD context。 */
    private String context;

    /** JSON-LD type。 */
    private String type;

    private String id;
    private String name;
    private String description;
    private String version;
    private String protocolVersion;
    private Map<String, Object> capabilities;
    private List<Map<String, Object>> endpoints;
    private Map<String, Object> authentication;
    private List<Map<String, Object>> skills;
    private List<String> defaultInputModes;
    private List<String> defaultOutputModes;
    private Map<String, Object> metadata;
}
