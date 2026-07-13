package com.metaplatform.appservice.domain.workflow;

import com.metaplatform.appservice.api.error.ApiResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 流程实例详情接口：供前端 BPMN 流程图高亮展示。
 */
@RestController
@RequestMapping("/api/apps/{appId}/process-instances")
public class ProcessInstanceController {

    private final ProcessInstanceService processInstanceService;

    public ProcessInstanceController(ProcessInstanceService processInstanceService) {
        this.processInstanceService = processInstanceService;
    }

    @GetMapping("/{processInstanceId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String appId,
                                                @PathVariable String processInstanceId) {
        return ApiResponse.ok(processInstanceService.getDetail(appId, processInstanceId), MDC.get("traceId"));
    }
}
