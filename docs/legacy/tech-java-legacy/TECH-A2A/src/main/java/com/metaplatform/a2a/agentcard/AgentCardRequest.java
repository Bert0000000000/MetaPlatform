package com.metaplatform.a2a.agentcard;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * 创建 / 更新 Agent Card 请求。
 *
 * <p>对应 Python {@code app.agent_card.schemas.AgentCardCreate}。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgentCardRequest {

    @NotBlank
    @Size(max = 256)
    private String name;

    @Size(max = 2048)
    private String description = "";

    /** Card 版本号（语义化版本）。 */
    private String version = "1.0.0";

    /** A2A 协议版本。 */
    private String protocolVersion = "0.3.0";

    /** 能力声明（JSON 数组）。 */
    private List<String> capabilities;

    /** 端点（JSON 对象，含 url / transport / auth 等）。 */
    private Map<String, Object> endpoints;

    /** 认证配置（JSON 对象）。 */
    private Map<String, Object> authentication;

    /** 元数据（JSON 对象）。 */
    private Map<String, Object> metadata;

    /** 状态：PUBLISHED / DRAFT。 */
    private String status = "PUBLISHED";
}
