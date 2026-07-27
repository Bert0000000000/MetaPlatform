package com.metaplatform.data.dbt;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.dbt.dto.CreateDbtProjectRequest;
import com.metaplatform.data.dbt.dto.DbtDagResponse;
import com.metaplatform.data.dbt.dto.DbtModelResponse;
import com.metaplatform.data.dbt.dto.DbtProjectResponse;
import com.metaplatform.data.dbt.dto.DbtRunResponse;
import com.metaplatform.data.dbt.dto.UpdateDbtProjectRequest;
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

import java.util.List;
import java.util.Map;

/**
 * dbt 项目端点。
 *
 * <p>对应 Python app/api/v1/dbt.py（10 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/dbt")
@RequiredArgsConstructor
public class DbtController {

    private final DbtService dbtService;

    @PostMapping("/projects")
    public ApiResponse<DbtProjectResponse> createProject(@Valid @RequestBody CreateDbtProjectRequest request) {
        return ApiResponse.success(dbtService.create(request));
    }

    @GetMapping("/projects")
    public ApiResponse<PageResponse<DbtProjectResponse>> listProjects(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(dbtService.list(page, pageSize));
    }

    @GetMapping("/projects/{projectId}")
    public ApiResponse<DbtProjectResponse> getProject(@PathVariable String projectId) {
        return ApiResponse.success(dbtService.get(projectId));
    }

    @PutMapping("/projects/{projectId}")
    public ApiResponse<DbtProjectResponse> updateProject(
            @PathVariable String projectId,
            @Valid @RequestBody UpdateDbtProjectRequest request) {
        return ApiResponse.success(dbtService.update(projectId, request));
    }

    @DeleteMapping("/projects/{projectId}")
    public ApiResponse<Map<String, Object>> deleteProject(@PathVariable String projectId) {
        boolean ok = dbtService.delete(projectId);
        return ApiResponse.success(Map.of("deleted", ok, "projectId", projectId));
    }

    @PostMapping("/projects/{projectId}/compile")
    public ApiResponse<DbtRunResponse> compile(@PathVariable String projectId) {
        return ApiResponse.success(dbtService.compile(projectId));
    }

    @PostMapping("/projects/{projectId}/run")
    public ApiResponse<DbtRunResponse> run(@PathVariable String projectId) {
        return ApiResponse.success(dbtService.run(projectId));
    }

    @GetMapping("/projects/{projectId}/dag")
    public ApiResponse<DbtDagResponse> getDag(@PathVariable String projectId) {
        return ApiResponse.success(dbtService.getDag(projectId));
    }

    @GetMapping("/projects/{projectId}/models")
    public ApiResponse<List<DbtModelResponse>> listModels(@PathVariable String projectId) {
        return ApiResponse.success(dbtService.listModels(projectId));
    }

    @GetMapping("/projects/{projectId}/runs")
    public ApiResponse<PageResponse<DbtRunResponse>> listRuns(
            @PathVariable String projectId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(dbtService.runs(projectId, page, pageSize));
    }
}
