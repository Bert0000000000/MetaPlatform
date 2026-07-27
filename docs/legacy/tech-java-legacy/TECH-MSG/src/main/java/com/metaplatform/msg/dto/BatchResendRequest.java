package com.metaplatform.msg.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchResendRequest {

    @NotEmpty(message = "消息ID列表不能为空")
    private List<String> ids;
}
