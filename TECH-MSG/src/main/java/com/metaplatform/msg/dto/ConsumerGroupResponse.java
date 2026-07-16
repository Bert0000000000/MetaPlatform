package com.metaplatform.msg.dto;

import com.metaplatform.msg.entity.ConsumerGroupEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsumerGroupResponse {

    private String id;
    private String tenantId;
    private String groupId;
    private String topicName;
    private Integer memberCount;
    private Long consumedOffset;
    private Long lag;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;

    public static ConsumerGroupResponse from(ConsumerGroupEntity e) {
        return ConsumerGroupResponse.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .groupId(e.getGroupId())
                .topicName(e.getTopicName())
                .memberCount(e.getMemberCount())
                .consumedOffset(e.getConsumedOffset())
                .lag(e.getLag())
                .status(e.getStatus().name())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
