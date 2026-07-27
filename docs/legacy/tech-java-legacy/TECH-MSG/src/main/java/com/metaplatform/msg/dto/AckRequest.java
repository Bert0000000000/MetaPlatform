package com.metaplatform.msg.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AckRequest {

    @NotNull(message = "消费偏移量不能为空")
    private Long consumedOffset;

    private Long lag;
}
