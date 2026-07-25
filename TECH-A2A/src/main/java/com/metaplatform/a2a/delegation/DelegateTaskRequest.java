package com.metaplatform.a2a.delegation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 委派任务请求。
 *
 * <p>对应 Python {@code app.delegation.schemas.DelegateTaskRequest}。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DelegateTaskRequest {

    @NotBlank
    @Size(max = 128)
    private String sourceAgentId;

    @NotBlank
    @Size(max = 128)
    private String targetAgentId;

    private String taskType = "generic";

    /** 任务负载（JSON 对象）。 */
    private Map<String, Object> payload;

    /** 超时秒数。 */
    private Double timeout;

    /** 回调 URL（可选）。 */
    @Size(max = 1024)
    private String callbackUrl;
}
