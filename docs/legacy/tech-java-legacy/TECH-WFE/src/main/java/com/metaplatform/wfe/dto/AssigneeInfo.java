package com.metaplatform.wfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 候选审批人信息（来自 TECH-IAM 解析）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssigneeInfo {

    private String userId;
    private String username;
}
