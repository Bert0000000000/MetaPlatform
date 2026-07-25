package com.metaplatform.agent.employees.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 数字员工响应 DTO（APP-DW 期望的投影格式）。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeResponse {

    private String employeeId;
    private String tenantId;
    private String name;
    private String code;
    private String roleCategory;
    private String roleIdentity;
    private String description;
    private String avatar;
    private String status;
    private Map<String, Object> capability;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
}
