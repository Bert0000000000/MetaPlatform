package com.metaplatform.msg.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsumerGroupRequest {

    @NotBlank(message = "租户ID不能为空")
    private String tenantId;

    @NotBlank(message = "消费者组ID不能为空")
    private String groupId;

    @NotBlank(message = "Topic名称不能为空")
    private String topicName;

    private Integer memberCount;
}
