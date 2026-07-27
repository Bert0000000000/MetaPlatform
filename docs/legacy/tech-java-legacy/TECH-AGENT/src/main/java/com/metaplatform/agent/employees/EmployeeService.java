package com.metaplatform.agent.employees;

import com.metaplatform.agent.agents.AgentService;
import com.metaplatform.agent.agents.dto.AgentResponse;
import com.metaplatform.agent.agents.dto.CreateAgentRequest;
import com.metaplatform.agent.agents.dto.UpdateAgentRequest;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.employees.dto.EmployeeResponse;
import com.metaplatform.agent.exception.AgentException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 数字员工服务：基于 {@link AgentService} 做投影转换。
 *
 * <p>对应 Python {@code app.api.v1.employees} 中的投影逻辑。
 * 将 Agent 实体投影为 APP-DW 期望的 Employee 格式。</p>
 */
@Service
@RequiredArgsConstructor
public class EmployeeService {

    // Agent 状态
    private static final String AGENT_DRAFT = "DRAFT";
    private static final String AGENT_ACTIVE = "ACTIVE";
    private static final String AGENT_DISABLED = "DISABLED";

    // Employee 状态（APP-DW 约定）
    private static final String EMP_DRAFT = "DRAFT";
    private static final String EMP_ACTIVE = "ACTIVE";
    private static final String EMP_INACTIVE = "INACTIVE";
    private static final String EMP_ARCHIVED = "ARCHIVED";

    private static final Set<String> ALLOWED_EMPLOYEE_STATUS =
            Set.of(EMP_DRAFT, EMP_ACTIVE, EMP_INACTIVE, EMP_ARCHIVED);

    private final AgentService agentService;

    // =====================================================================
    // 查询
    // =====================================================================

    /**
     * 数字员工列表（分页）。
     *
     * <p>先从 AgentService 取 Agent 列表，投影为 Employee 后再做 keyword/roleCategory 过滤。</p>
     */
    @Transactional(readOnly = true)
    public PageResponse<EmployeeResponse> list(
            String tenantId, String keyword, String status, String roleCategory,
            int page, int pageSize) {

        // 状态映射：Employee 状态 → Agent 状态
        String agentStatus = employeeStatusToAgent(status);

        PageResponse<AgentResponse> agentPage = agentService.list(tenantId, agentStatus, page, pageSize);
        List<EmployeeResponse> employees = agentPage.getItems().stream()
                .map(this::agentToEmployee)
                .toList();

        // keyword 过滤
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.toLowerCase(Locale.ROOT);
            employees = employees.stream()
                    .filter(e -> (e.getName() != null && e.getName().toLowerCase(Locale.ROOT).contains(kw))
                            || (e.getCode() != null && e.getCode().toLowerCase(Locale.ROOT).contains(kw))
                            || (e.getDescription() != null && e.getDescription().toLowerCase(Locale.ROOT).contains(kw)))
                    .toList();
        }

        // roleCategory 过滤
        if (roleCategory != null && !roleCategory.isBlank()) {
            employees = employees.stream()
                    .filter(e -> roleCategory.equals(e.getRoleCategory()))
                    .toList();
        }

        // 手动分页（过滤后重新分页）
        int total = employees.size();
        int fromIndex = Math.min((page - 1) * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<EmployeeResponse> pageItems = employees.subList(fromIndex, toIndex);

        return PageResponse.of(pageItems, total, page, pageSize);
    }

    /**
     * 数字员工详情。
     */
    @Transactional(readOnly = true)
    public EmployeeResponse get(String tenantId, String employeeId) {
        AgentResponse agent = agentService.get(tenantId, employeeId);
        return agentToEmployee(agent);
    }

    // =====================================================================
    // 写操作（委托 AgentService）
    // =====================================================================

    /**
     * 创建数字员工。
     */
    @Transactional
    public EmployeeResponse create(String tenantId, CreateAgentRequest request, String createdBy) {
        AgentResponse agent = agentService.create(tenantId, request, createdBy);
        return agentToEmployee(agent);
    }

    /**
     * 更新数字员工。
     */
    @Transactional
    public EmployeeResponse update(String tenantId, String employeeId, UpdateAgentRequest request, String updatedBy) {
        AgentResponse agent = agentService.update(tenantId, employeeId, request, updatedBy);
        return agentToEmployee(agent);
    }

    /**
     * 更新数字员工状态。
     */
    @Transactional
    public EmployeeResponse updateStatus(String tenantId, String employeeId, String employeeStatus, String updatedBy) {
        String agentStatus = employeeStatusToAgent(employeeStatus);
        UpdateAgentRequest request = new UpdateAgentRequest();
        request.setStatus(agentStatus);
        AgentResponse agent = agentService.update(tenantId, employeeId, request, updatedBy);
        return agentToEmployee(agent);
    }

    /**
     * 删除数字员工。
     */
    @Transactional
    public boolean delete(String tenantId, String employeeId, String deletedBy) {
        return agentService.delete(tenantId, employeeId, deletedBy);
    }

    // =====================================================================
    // 投影转换
    // =====================================================================

    /**
     * Agent → Employee 投影。
     */
    private EmployeeResponse agentToEmployee(AgentResponse agent) {
        String employeeStatus = agentToEmployeeStatus(agent.getStatus());
        String roleCategory = inferRoleCategory(agent.getCode(), agent.getName());

        Map<String, Object> capability = new LinkedHashMap<>();
        capability.put("model", agent.getModelId() != null ? agent.getModelId() : "doubao-lite");
        capability.put("temperature", agent.getTemperature() != null ? agent.getTemperature() : 0.7);
        capability.put("maxTokens", agent.getMaxTokens() != null ? agent.getMaxTokens() : 4096);
        capability.put("topP", 0.9);
        capability.put("systemPrompt", agent.getSystemPrompt() != null ? agent.getSystemPrompt() : "");
        capability.put("tools", agent.getTools() != null ? agent.getTools() : List.of());
        capability.put("ragKnowledgeBaseIds", agent.getRagScopes() != null ? agent.getRagScopes() : List.of());
        capability.put("retrievalMethod", "hybrid");
        capability.put("topK", 5);
        capability.put("rerank", false);

        return EmployeeResponse.builder()
                .employeeId(agent.getAgentId())
                .tenantId(agent.getTenantId())
                .name(agent.getName())
                .code(agent.getCode())
                .roleCategory(roleCategory)
                .roleIdentity(agent.getDescription() != null && !agent.getDescription().isBlank()
                        ? agent.getDescription() : agent.getName())
                .description(agent.getDescription() != null ? agent.getDescription() : "")
                .avatar(null)
                .status(employeeStatus)
                .capability(capability)
                .createdAt(agent.getCreatedAt())
                .updatedAt(agent.getUpdatedAt())
                .createdBy(null)
                .updatedBy(null)
                .build();
    }

    /**
     * Agent 状态 → Employee 状态。
     */
    private static String agentToEmployeeStatus(String agentStatus) {
        if (agentStatus == null) {
            return EMP_DRAFT;
        }
        return switch (agentStatus.toUpperCase(Locale.ROOT)) {
            case AGENT_DRAFT -> EMP_DRAFT;
            case AGENT_ACTIVE -> EMP_ACTIVE;
            case AGENT_DISABLED -> EMP_INACTIVE;
            default -> EMP_DRAFT;
        };
    }

    /**
     * Employee 状态 → Agent 状态。
     */
    private static String employeeStatusToAgent(String employeeStatus) {
        if (employeeStatus == null || employeeStatus.isBlank()) {
            return null;
        }
        String upper = employeeStatus.toUpperCase(Locale.ROOT);
        if (!ALLOWED_EMPLOYEE_STATUS.contains(upper)) {
            throw AgentException.invalidParam("不支持的 Employee 状态: " + employeeStatus);
        }
        return switch (upper) {
            case EMP_DRAFT -> AGENT_DRAFT;
            case EMP_ACTIVE -> AGENT_ACTIVE;
            case EMP_INACTIVE -> AGENT_DISABLED;
            case EMP_ARCHIVED -> AGENT_DISABLED;
            default -> null;
        };
    }

    /**
     * 关键字推断角色类别。
     */
    private static String inferRoleCategory(String code, String name) {
        String text = (code + " " + name).toLowerCase(Locale.ROOT);
        if (containsAny(text, "contract", "legal", "law", "合规", "法务", "合同")) {
            return "LEGAL";
        }
        if (containsAny(text, "finance", "财务", "报销", "发票", "预算")) {
            return "FINANCE";
        }
        if (containsAny(text, "hr", "人事", "招聘", "考勤", "员工")) {
            return "HR";
        }
        if (containsAny(text, "data", "report", "分析", "报表", "统计", "日报")) {
            return "DATA_ANALYST";
        }
        if (containsAny(text, "service", "客服", "售后", "支持")) {
            return "CUSTOMER_SERVICE";
        }
        return "CUSTOM";
    }

    private static boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) {
                return true;
            }
        }
        return false;
    }
}
