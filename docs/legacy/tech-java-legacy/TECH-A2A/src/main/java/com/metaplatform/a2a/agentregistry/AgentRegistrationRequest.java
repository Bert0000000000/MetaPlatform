package com.metaplatform.a2a.agentregistry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * Agent 注册请求。
 *
 * <p>对应 Python {@code app.agent_registry.schemas.AgentRegistrationRequest}。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgentRegistrationRequest {

    @NotBlank
    @Size(max = 128)
    private String agentId;

    @NotBlank
    @Size(max = 256)
    private String name;

    @Size(max = 2048)
    private String description = "";

    private List<Map<String, Object>> endpoints;
    private List<String> capabilities;
    private Map<String, Object> metadata;
    private String status = "HEALTHY";
}
