package com.metaplatform.agent.employees;

import com.metaplatform.agent.agents.dto.CreateAgentRequest;
import com.metaplatform.agent.agents.dto.UpdateAgentRequest;
import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.employees.dto.EmployeeResponse;
import com.metaplatform.agent.employees.dto.UpdateEmployeeStatusRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 数字员工端点 — Agent 实体的投影接口（APP-DW 对接）。
 *
 * <p>对应 Python {@code app.api.v1.employees}。</p>
 */
@RestController
@RequestMapping("/api/v1/agent/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    public ApiResponse<PageResponse<EmployeeResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String roleCategory,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<EmployeeResponse> result = employeeService.list(
                TenantContext.getTenantIdOrDefault(), keyword, status, roleCategory, page, pageSize);
        return ApiResponse.success(result);
    }

    @GetMapping("/{employeeId}")
    public ApiResponse<EmployeeResponse> get(@PathVariable String employeeId) {
        EmployeeResponse response = employeeService.get(TenantContext.getTenantIdOrDefault(), employeeId);
        return ApiResponse.success(response);
    }

    @PostMapping
    public ApiResponse<EmployeeResponse> create(@Valid @RequestBody CreateAgentRequest request) {
        EmployeeResponse response = employeeService.create(
                TenantContext.getTenantIdOrDefault(), request, TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @PutMapping("/{employeeId}")
    public ApiResponse<EmployeeResponse> update(
            @PathVariable String employeeId,
            @Valid @RequestBody UpdateAgentRequest request) {
        EmployeeResponse response = employeeService.update(
                TenantContext.getTenantIdOrDefault(), employeeId, request, TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @PutMapping("/{employeeId}/status")
    public ApiResponse<EmployeeResponse> updateStatus(
            @PathVariable String employeeId,
            @Valid @RequestBody UpdateEmployeeStatusRequest request) {
        EmployeeResponse response = employeeService.updateStatus(
                TenantContext.getTenantIdOrDefault(), employeeId, request.getStatus(), TenantContext.getUserId());
        return ApiResponse.success(response);
    }

    @DeleteMapping("/{employeeId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String employeeId) {
        boolean ok = employeeService.delete(
                TenantContext.getTenantIdOrDefault(), employeeId, TenantContext.getUserId());
        return ApiResponse.success(Map.of("deleted", ok, "employeeId", employeeId));
    }
}
