package com.metaplatform.agent.checkpoint;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 保存检查点请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SaveCheckpointRequest {

    /** Agent ID。 */
    @NotBlank(message = "agentId 不能为空")
    private String agentId;

    /** 可序列化的执行状态。 */
    private Map<String, Object> state;
}
