package com.metaplatform.agent.plans;

import com.metaplatform.agent.exception.AgentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 自主任务计划服务（V15-02）。
 *
 * <p>规则模板分解 + 内存存储 + mock 执行。生产环境应替换为持久化存储并对接 TECH-ACTION。</p>
 */
@Slf4j
@Service
public class PlanService {

    // ---- PlanStepStatus 常量 ----
    public static final String STEP_PENDING = "pending";
    public static final String STEP_RUNNING = "running";
    public static final String STEP_COMPLETED = "completed";
    public static final String STEP_FAILED = "failed";
    public static final String STEP_SKIPPED = "skipped";
    public static final String STEP_APPROVED = "approved";

    // ---- PlanStatus 常量 ----
    public static final String PLAN_DRAFT = "draft";
    public static final String PLAN_READY = "ready";
    public static final String PLAN_RUNNING = "running";
    public static final String PLAN_COMPLETED = "completed";
    public static final String PLAN_FAILED = "failed";
    public static final String PLAN_CANCELLED = "cancelled";

    // (tenantId:planId) → plan
    private final Map<String, Plan> store = new ConcurrentHashMap<>();

    // =============================================================== create

    public Plan create(String tenantId, CreatePlanRequest request) {
        DecomposeResult decomposed = decompose(request.getUserInput());
        OffsetDateTime now = OffsetDateTime.now();
        Plan plan = Plan.builder()
                .planId("plan-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .tenantId(tenantId)
                .title(request.getTitle() != null ? request.getTitle() : decomposed.title)
                .description("自主分解任务：" + decomposed.title)
                .userInput(request.getUserInput())
                .agentId(request.getAgentId())
                .status(PLAN_READY)
                .steps(decomposed.steps)
                .createdAt(now)
                .updatedAt(now)
                .build();
        store.put(tenantKey(tenantId, plan.getPlanId()), plan);
        return plan;
    }

    public Plan get(String tenantId, String planId) {
        Plan plan = store.get(tenantKey(tenantId, planId));
        if (plan == null) {
            throw AgentException.invalidParam("计划不存在: planId=" + planId);
        }
        return plan;
    }

    public List<Plan> list(String tenantId, String agentId, int page, int pageSize) {
        List<Plan> all = store.values().stream()
                .filter(p -> tenantId.equals(p.getTenantId()))
                .filter(p -> agentId == null || agentId.isBlank() || agentId.equals(p.getAgentId()))
                .sorted(Comparator.comparing(Plan::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
        int total = all.size();
        int start = Math.min((page - 1) * pageSize, total);
        int end = Math.min(start + pageSize, total);
        return all.subList(start, end);
    }

    public int count(String tenantId, String agentId) {
        return (int) store.values().stream()
                .filter(p -> tenantId.equals(p.getTenantId()))
                .filter(p -> agentId == null || agentId.isBlank() || agentId.equals(p.getAgentId()))
                .count();
    }

    // =============================================================== approve / skip

    public Plan approveStep(String tenantId, String planId, String stepId) {
        Plan plan = get(tenantId, planId);
        requireStatus(plan, PLAN_READY, PLAN_RUNNING);

        List<PlanStep> updatedSteps = new ArrayList<>();
        for (PlanStep s : plan.getSteps()) {
            if (s.getStepId().equals(stepId)) {
                if (!STEP_PENDING.equals(s.getStatus())) {
                    throw AgentException.invalidParam("步骤当前状态不允许批准: status=" + s.getStatus());
                }
                PlanStep copy = copyStep(s);
                copy.setStatus(STEP_APPROVED);
                updatedSteps.add(copy);
            } else {
                updatedSteps.add(s);
            }
        }
        return updatePlan(tenantId, planId, updatedSteps, null);
    }

    public Plan skipStep(String tenantId, String planId, String stepId) {
        Plan plan = get(tenantId, planId);
        requireStatus(plan, PLAN_READY, PLAN_RUNNING);

        List<PlanStep> updatedSteps = new ArrayList<>();
        for (PlanStep s : plan.getSteps()) {
            if (s.getStepId().equals(stepId)) {
                if (STEP_COMPLETED.equals(s.getStatus()) || STEP_RUNNING.equals(s.getStatus())
                        || STEP_SKIPPED.equals(s.getStatus())) {
                    throw AgentException.invalidParam("步骤当前状态不允许跳过: status=" + s.getStatus());
                }
                PlanStep copy = copyStep(s);
                copy.setStatus(STEP_SKIPPED);
                updatedSteps.add(copy);
            } else {
                updatedSteps.add(s);
            }
        }
        return updatePlan(tenantId, planId, updatedSteps, null);
    }

    // =============================================================== execute

    public Plan execute(String tenantId, String planId) {
        Plan plan = get(tenantId, planId);
        if (PLAN_RUNNING.equals(plan.getStatus())) {
            throw AgentException.invalidParam("计划正在执行中，请勿重复触发");
        }
        if (PLAN_COMPLETED.equals(plan.getStatus()) || PLAN_CANCELLED.equals(plan.getStatus())) {
            throw AgentException.invalidParam("计划已结束，无法执行: status=" + plan.getStatus());
        }

        OffsetDateTime now = OffsetDateTime.now();
        plan.setStatus(PLAN_RUNNING);
        plan.setUpdatedAt(now);
        store.put(tenantKey(tenantId, planId), plan);

        List<PlanStep> updatedSteps = new ArrayList<>();
        for (PlanStep s : plan.getSteps()) {
            if (STEP_SKIPPED.equals(s.getStatus()) || STEP_COMPLETED.equals(s.getStatus())
                    || STEP_FAILED.equals(s.getStatus())) {
                updatedSteps.add(s);
                continue;
            }
            if (s.isRequiresApproval() && !STEP_APPROVED.equals(s.getStatus())) {
                // 需要审批但未审批，暂停
                updatedSteps.add(s);
                continue;
            }
            // mock 执行：总是成功
            PlanStep copy = copyStep(s);
            copy.setStatus(STEP_COMPLETED);
            copy.setStartedAt(now);
            copy.setCompletedAt(now);
            copy.setOutput(Map.<String, Object>of("mock", true, "action", s.getAction() != null ? s.getAction() : ""));
            updatedSteps.add(copy);
        }

        // 确定最终状态
        String finalStatus;
        boolean hasFailed = updatedSteps.stream().anyMatch(s -> STEP_FAILED.equals(s.getStatus()));
        boolean allDone = updatedSteps.stream().allMatch(s ->
                STEP_COMPLETED.equals(s.getStatus()) || STEP_SKIPPED.equals(s.getStatus()));
        if (hasFailed) {
            finalStatus = PLAN_FAILED;
        } else if (allDone) {
            finalStatus = PLAN_COMPLETED;
        } else {
            finalStatus = PLAN_RUNNING;
        }

        return updatePlan(tenantId, planId, updatedSteps, finalStatus);
    }

    // =============================================================== internal

    private Plan updatePlan(String tenantId, String planId, List<PlanStep> steps, String status) {
        Plan plan = store.get(tenantKey(tenantId, planId));
        if (plan == null) {
            throw AgentException.invalidParam("计划不存在: planId=" + planId);
        }
        plan.setSteps(steps);
        if (status != null) {
            plan.setStatus(status);
        }
        plan.setUpdatedAt(OffsetDateTime.now());
        store.put(tenantKey(tenantId, planId), plan);
        return plan;
    }

    private void requireStatus(Plan plan, String... allowed) {
        for (String s : allowed) {
            if (s.equals(plan.getStatus())) {
                return;
            }
        }
        throw AgentException.invalidParam("计划当前状态不允许操作: status=" + plan.getStatus());
    }

    private PlanStep copyStep(PlanStep s) {
        return PlanStep.builder()
                .stepId(s.getStepId())
                .title(s.getTitle())
                .description(s.getDescription())
                .action(s.getAction())
                .status(s.getStatus())
                .order(s.getOrder())
                .requiresApproval(s.isRequiresApproval())
                .input(s.getInput())
                .output(s.getOutput())
                .errorMessage(s.getErrorMessage())
                .startedAt(s.getStartedAt())
                .completedAt(s.getCompletedAt())
                .build();
    }

    // =============================================================== decompose

    /**
     * 分解结果。
     */
    private static class DecomposeResult {
        final String title;
        final List<PlanStep> steps;

        DecomposeResult(String title, List<PlanStep> steps) {
            this.title = title;
            this.steps = steps;
        }
    }

    private DecomposeResult decompose(String userInput) {
        String text = userInput.toLowerCase();
        boolean hasReport = anyContains(text, "周报", "月报", "日报", "报告", "总结");
        boolean hasEmail = anyContains(text, "邮件", "发送", "通知");
        boolean hasAnalysis = anyContains(text, "分析", "统计", "趋势");
        boolean hasData = anyContains(text, "数据", "销售", "客户", "订单", "业绩");
        boolean hasChurn = text.contains("流失");

        if (hasChurn && hasData) {
            return new DecomposeResult("客户流失分析", buildCustomerChurnSteps(userInput));
        }
        if (hasReport && hasEmail) {
            return new DecomposeResult("报告生成与发送", buildReportWithEmailSteps(userInput));
        }
        if (hasReport && hasAnalysis && hasData) {
            return new DecomposeResult("数据分析与报告", buildReportWithEmailSteps(userInput));
        }
        if (hasAnalysis && hasData) {
            return new DecomposeResult("数据分析", buildDataAnalysisSteps(userInput));
        }
        if (hasEmail) {
            return new DecomposeResult("邮件任务", buildEmailSteps(userInput));
        }
        return new DecomposeResult("通用任务", buildDefaultSteps(userInput));
    }

    private static boolean anyContains(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    private String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private String newStepId() {
        return "step-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private List<PlanStep> buildDataAnalysisSteps(String userInput) {
        String preview = truncate(userInput, 60);
        return List.of(
                PlanStep.builder().stepId(newStepId()).title("查询数据")
                        .description("根据需求「" + preview + "」查询所需数据源")
                        .action("query_data").status(STEP_PENDING).order(0).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("数据分析")
                        .description("对查询结果进行统计分析与可视化")
                        .action("analyze_data").status(STEP_PENDING).order(1).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("生成报告")
                        .description("汇总分析结果并生成结构化报告")
                        .action("generate_report").status(STEP_PENDING).order(2).requiresApproval(true).build());
    }

    private List<PlanStep> buildReportWithEmailSteps(String userInput) {
        String preview = truncate(userInput, 60);
        return List.of(
                PlanStep.builder().stepId(newStepId()).title("查询数据")
                        .description("根据需求「" + preview + "」查询业务数据")
                        .action("query_data").status(STEP_PENDING).order(0).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("数据分析")
                        .description("对数据进行统计与趋势分析")
                        .action("analyze_data").status(STEP_PENDING).order(1).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("生成报告")
                        .description("生成周报/月报/日报文档")
                        .action("generate_report").status(STEP_PENDING).order(2).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("发送邮件")
                        .description("将报告通过邮件发送给相关人")
                        .action("send_email").status(STEP_PENDING).order(3).requiresApproval(true).build());
    }

    private List<PlanStep> buildCustomerChurnSteps(String userInput) {
        String preview = truncate(userInput, 60);
        return List.of(
                PlanStep.builder().stepId(newStepId()).title("查询客户数据")
                        .description("拉取客户相关数据：" + preview)
                        .action("query_customer_data").status(STEP_PENDING).order(0).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("分析流失原因")
                        .description("使用统计模型识别流失关键因子")
                        .action("analyze_churn").status(STEP_PENDING).order(1).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("生成分析报告")
                        .description("输出流失原因分析与建议")
                        .action("generate_report").status(STEP_PENDING).order(2).requiresApproval(true).build());
    }

    private List<PlanStep> buildEmailSteps(String userInput) {
        String preview = truncate(userInput, 60);
        return List.of(
                PlanStep.builder().stepId(newStepId()).title("准备内容")
                        .description("基于需求「" + preview + "」准备邮件正文与附件")
                        .action("prepare_content").status(STEP_PENDING).order(0).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("发送邮件")
                        .description("通过邮件服务发送给目标收件人")
                        .action("send_email").status(STEP_PENDING).order(1).requiresApproval(true).build());
    }

    private List<PlanStep> buildDefaultSteps(String userInput) {
        String preview = truncate(userInput, 60);
        return List.of(
                PlanStep.builder().stepId(newStepId()).title("理解需求")
                        .description("解析任务意图：" + preview)
                        .action("understand_intent").status(STEP_PENDING).order(0).requiresApproval(false).build(),
                PlanStep.builder().stepId(newStepId()).title("执行任务")
                        .description("调用相关工具与 Action 完成任务")
                        .action("execute_task").status(STEP_PENDING).order(1).requiresApproval(true).build(),
                PlanStep.builder().stepId(newStepId()).title("返回结果")
                        .description("整理结果并返回给用户")
                        .action("return_result").status(STEP_PENDING).order(2).requiresApproval(false).build());
    }

    private static String tenantKey(String tenantId, String planId) {
        return tenantId + ":" + planId;
    }
}
