package com.metaplatform.agent.collaboration;

import com.metaplatform.agent.agents.AgentService;
import com.metaplatform.agent.agents.dto.AgentResponse;
import com.metaplatform.agent.exception.AgentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 数字员工团队协作服务（V15-04）。
 *
 * <p>编排多员工协作：
 * <ul>
 *   <li>将目标分解为子任务并按关键词技能匹配自动分工</li>
 *   <li>按依赖关系执行子任务（mock 同步执行）</li>
 *   <li>聚合每个员工的贡献并计算效率提升</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
public class CollaborationService {

    // ---- CollaborationStatus 常量 ----
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_FAILED = "failed";

    // ---- SubTaskStatus 常量 ----
    public static final String SUB_PENDING = "pending";
    public static final String SUB_RUNNING = "running";
    public static final String SUB_COMPLETED = "completed";
    public static final String SUB_FAILED = "failed";

    // ---- SplitStrategy 常量 ----
    public static final String STRATEGY_SEQUENTIAL = "sequential";
    public static final String STRATEGY_PARALLEL = "parallel";
    public static final String STRATEGY_HYBRID = "hybrid";

    // (tenantId:collaborationId) → task
    private final Map<String, CollaborationTask> store = new ConcurrentHashMap<>();

    private final AgentService agentService;

    @Autowired
    public CollaborationService(@Autowired(required = false) AgentService agentService) {
        this.agentService = agentService;
    }

    // =============================================================== create

    public CollaborationTask create(String tenantId, CreateCollaborationRequest request, String createdBy) {
        List<AgentResponse> employees = fetchEmployees(tenantId, request.getEmployeeIds());
        if (employees.isEmpty()) {
            throw AgentException.invalidParam("协作任务至少需要一个有效员工");
        }

        DecomposeResult decomposed = decompose(request.getGoal());
        String splitStrategy = request.getSplitStrategy() != null ? request.getSplitStrategy() : STRATEGY_PARALLEL;
        List<SubTask> subtasks = buildSubtasks(decomposed.templates, employees, splitStrategy);

        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle() : decomposed.templateName;
        String description = (request.getDescription() != null && !request.getDescription().isBlank())
                ? request.getDescription() : "自主协商分工：" + decomposed.templateName;

        OffsetDateTime now = OffsetDateTime.now();
        CollaborationTask task = CollaborationTask.builder()
                .collaborationId("collab-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24))
                .tenantId(tenantId)
                .title(title)
                .description(description)
                .goal(request.getGoal())
                .splitStrategy(splitStrategy)
                .subtasks(subtasks)
                .status(STATUS_PENDING)
                .createdBy(createdBy)
                .createdAt(now)
                .updatedAt(now)
                .build();
        store.put(tenantKey(tenantId, task.getCollaborationId()), task);
        return task;
    }

    // =============================================================== read

    public CollaborationTask get(String tenantId, String collaborationId) {
        CollaborationTask task = store.get(tenantKey(tenantId, collaborationId));
        if (task == null) {
            throw AgentException.invalidParam("协作任务不存在: collaborationId=" + collaborationId);
        }
        return task;
    }

    public List<CollaborationTask> list(String tenantId, String status, int page, int pageSize) {
        List<CollaborationTask> all = store.values().stream()
                .filter(t -> tenantId.equals(t.getTenantId()))
                .filter(t -> status == null || status.isBlank() || status.equals(t.getStatus()))
                .sorted(Comparator.comparing(CollaborationTask::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
        int total = all.size();
        int start = Math.min((page - 1) * pageSize, total);
        int end = Math.min(start + pageSize, total);
        return all.subList(start, end);
    }

    public int count(String tenantId, String status) {
        return (int) store.values().stream()
                .filter(t -> tenantId.equals(t.getTenantId()))
                .filter(t -> status == null || status.isBlank() || status.equals(t.getStatus()))
                .count();
    }

    // =============================================================== execute

    public CollaborationTask execute(String tenantId, String collaborationId) {
        CollaborationTask task = get(tenantId, collaborationId);
        if (STATUS_RUNNING.equals(task.getStatus())) {
            throw AgentException.invalidParam("协作任务正在执行中，请勿重复触发");
        }
        if (STATUS_COMPLETED.equals(task.getStatus()) || STATUS_FAILED.equals(task.getStatus())) {
            throw AgentException.invalidParam("协作任务已结束，无法执行: status=" + task.getStatus());
        }

        OffsetDateTime now = OffsetDateTime.now();
        task.setStatus(STATUS_RUNNING);
        task.setStartedAt(now);
        task.setUpdatedAt(now);
        store.put(tenantKey(tenantId, collaborationId), task);

        // 拓扑排序
        List<SubTask> ordered = topologicalOrder(task.getSubtasks());
        Map<String, OffsetDateTime> completionTimes = new HashMap<>();
        Map<String, SubTask> updatedMap = new HashMap<>();

        OffsetDateTime execStart = now;
        for (SubTask st : ordered) {
            SubTask original = findById(task.getSubtasks(), st.getId());
            List<String> dependsOn = original.getDependsOn();
            OffsetDateTime started;
            if (dependsOn != null && !dependsOn.isEmpty()) {
                OffsetDateTime depFinish = null;
                for (String dep : dependsOn) {
                    OffsetDateTime ct = completionTimes.get(dep);
                    if (ct != null && (depFinish == null || ct.isAfter(depFinish))) {
                        depFinish = ct;
                    }
                }
                started = depFinish != null ? depFinish : execStart;
            } else {
                started = execStart;
            }

            int duration = Math.max(1, original.getEstimatedSeconds());
            OffsetDateTime completed = started;
            completionTimes.put(st.getId(), completed);

            SubTask updated = copySubTask(original);
            updated.setStatus(SUB_COMPLETED);
            updated.setProgress(100);
            updated.setActualSeconds(duration);
            updated.setResult("已完成：" + original.getTitle());
            updated.setStartedAt(started);
            updated.setCompletedAt(completed);
            updatedMap.put(st.getId(), updated);
        }

        // 按原始顺序输出
        List<SubTask> finalSubtasks = task.getSubtasks().stream()
                .map(st -> updatedMap.getOrDefault(st.getId(), st))
                .collect(Collectors.toList());

        OffsetDateTime execEnd = finalSubtasks.stream()
                .map(SubTask::getCompletedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(execStart);

        task.setSubtasks(finalSubtasks);
        task.setStatus(STATUS_COMPLETED);
        task.setCompletedAt(execEnd);
        task.setUpdatedAt(OffsetDateTime.now());

        // 生成报告
        CollaborationReport report = buildReport(task, execStart, execEnd);
        task.setFinalReport(report.getFinalReport());
        store.put(tenantKey(tenantId, collaborationId), task);
        return task;
    }

    // =============================================================== report

    public CollaborationReport getReport(String tenantId, String collaborationId) {
        CollaborationTask task = get(tenantId, collaborationId);
        OffsetDateTime execStart = task.getStartedAt() != null ? task.getStartedAt() : task.getCreatedAt();
        OffsetDateTime execEnd = task.getCompletedAt() != null ? task.getCompletedAt() : OffsetDateTime.now();
        return buildReport(task, execStart, execEnd);
    }

    // =============================================================== internal: agents

    private List<AgentResponse> fetchEmployees(String tenantId, List<String> employeeIds) {
        if (employeeIds == null || employeeIds.isEmpty()) {
            return List.of();
        }
        List<AgentResponse> employees = new ArrayList<>();
        for (String eid : employeeIds) {
            if (agentService == null) {
                // Stub: 无 AgentService 时构造占位 Agent
                employees.add(AgentResponse.builder()
                        .agentId(eid)
                        .tenantId(tenantId)
                        .code(eid)
                        .name(eid)
                        .description("")
                        .modelId("doubao-lite")
                        .systemPrompt("")
                        .build());
                continue;
            }
            try {
                employees.add(agentService.get(tenantId, eid));
            } catch (Exception e) {
                // 跳过无效 id
                log.debug("Skip employee {} when fetching: {}", eid, e.getMessage());
            }
        }
        return employees;
    }

    // =============================================================== internal: decompose & assign

    /**
     * 分解结果。
     */
    private static class DecomposeResult {
        final String templateName;
        final List<SubTaskTemplate> templates;

        DecomposeResult(String templateName, List<SubTaskTemplate> templates) {
            this.templateName = templateName;
            this.templates = templates;
        }
    }

    private static class SubTaskTemplate {
        final String title;
        final String description;
        final String skillKeyword;
        final int estimatedSeconds;
        final int[] dependsOnIndex;

        SubTaskTemplate(String title, String description, String skillKeyword,
                        int estimatedSeconds, int[] dependsOnIndex) {
            this.title = title;
            this.description = description;
            this.skillKeyword = skillKeyword;
            this.estimatedSeconds = estimatedSeconds;
            this.dependsOnIndex = dependsOnIndex;
        }
    }

    private DecomposeResult decompose(String goal) {
        String text = goal.toLowerCase();
        boolean hasReport = anyContains(text, "周报", "月报", "日报", "报告", "总结");
        boolean hasEmail = anyContains(text, "邮件", "发送", "通知");
        boolean hasAnalysis = anyContains(text, "分析", "统计", "趋势");
        boolean hasData = anyContains(text, "数据", "销售", "客户", "订单", "业绩");
        boolean hasChurn = text.contains("流失");

        if (hasChurn && hasData) {
            return new DecomposeResult("客户流失分析", TEMPLATE_CUSTOMER_CHURN);
        }
        if (hasReport && hasEmail) {
            return new DecomposeResult("报告生成与发送", TEMPLATE_REPORT_WITH_EMAIL);
        }
        if (hasReport && hasAnalysis && hasData) {
            return new DecomposeResult("数据分析与报告", TEMPLATE_REPORT_WITH_EMAIL);
        }
        if (hasAnalysis && hasData) {
            return new DecomposeResult("数据分析", TEMPLATE_DATA_ANALYSIS);
        }
        if (hasEmail) {
            return new DecomposeResult("邮件任务", TEMPLATE_EMAIL_ONLY);
        }
        return new DecomposeResult("通用任务", TEMPLATE_DEFAULT);
    }

    private List<SubTask> buildSubtasks(List<SubTaskTemplate> templates,
                                         List<AgentResponse> employees,
                                         String splitStrategy) {
        List<String> subtaskIds = templates.stream()
                .map(t -> "sub-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .collect(Collectors.toList());

        List<SubTask> subtasks = new ArrayList<>();
        for (int i = 0; i < templates.size(); i++) {
            SubTaskTemplate tmpl = templates.get(i);
            List<String> roleCategories = SKILL_KEYWORD_MAP.get(tmpl.skillKeyword);
            if (roleCategories == null) {
                roleCategories = List.of();
            }
            AgentResponse assignee = pickEmployee(employees, roleCategories);

            List<String> dependsOn = new ArrayList<>();
            if (STRATEGY_SEQUENTIAL.equals(splitStrategy)) {
                if (i > 0) {
                    dependsOn.add(subtaskIds.get(i - 1));
                }
            } else if (STRATEGY_HYBRID.equals(splitStrategy)) {
                for (int idx : tmpl.dependsOnIndex) {
                    dependsOn.add(subtaskIds.get(idx));
                }
            }

            subtasks.add(SubTask.builder()
                    .id(subtaskIds.get(i))
                    .employeeId(assignee.getAgentId())
                    .title(tmpl.title)
                    .description(tmpl.description)
                    .skillTags(List.of(tmpl.skillKeyword))
                    .dependsOn(dependsOn)
                    .estimatedSeconds(tmpl.estimatedSeconds)
                    .status(SUB_PENDING)
                    .progress(0)
                    .actualSeconds(0)
                    .build());
        }
        return subtasks;
    }

    private AgentResponse pickEmployee(List<AgentResponse> employees, List<String> roleCategories) {
        if (employees.isEmpty()) {
            throw AgentException.invalidParam("员工列表为空，无法分配子任务");
        }
        if (roleCategories.isEmpty()) {
            return employees.get(0);
        }
        AgentResponse best = null;
        int bestScore = -1;
        for (AgentResponse agent : employees) {
            int score = 0;
            for (String role : roleCategories) {
                score = Math.max(score, keywordMatchScore(agent, role));
            }
            if (score > bestScore) {
                bestScore = score;
                best = agent;
            }
        }
        return best;
    }

    private static String inferRoleCategory(AgentResponse agent) {
        String text = ((agent.getCode() != null ? agent.getCode() : "") + " "
                + (agent.getName() != null ? agent.getName() : "") + " "
                + (agent.getDescription() != null ? agent.getDescription() : "")).toLowerCase();
        if (anyContains(text, "contract", "legal", "law", "合规", "法务", "合同")) return "LEGAL";
        if (anyContains(text, "finance", "财务", "报销", "发票", "预算")) return "FINANCE";
        if (anyContains(text, "hr", "人事", "招聘", "考勤")) return "HR";
        if (anyContains(text, "data", "report", "分析", "报表", "统计", "日报")) return "DATA_ANALYST";
        if (anyContains(text, "service", "客服", "售后", "支持")) return "CUSTOMER_SERVICE";
        return "CUSTOM";
    }

    private static int keywordMatchScore(AgentResponse agent, String roleCategory) {
        String inferred = inferRoleCategory(agent);
        if (inferred.equals(roleCategory)) {
            return 3;
        }
        String text = ((agent.getCode() != null ? agent.getCode() : "") + " "
                + (agent.getName() != null ? agent.getName() : "") + " "
                + (agent.getDescription() != null ? agent.getDescription() : "")).toLowerCase();
        switch (roleCategory) {
            case "FINANCE":
                return anyContains(text, "财务", "finance", "报销", "发票") ? 2 : 1;
            case "HR":
                return anyContains(text, "hr", "人事", "招聘") ? 2 : 1;
            case "LEGAL":
                return anyContains(text, "法务", "legal", "合同", "合规") ? 2 : 1;
            case "DATA_ANALYST":
                return anyContains(text, "数据", "分析", "data", "analyst") ? 2 : 1;
            case "CUSTOMER_SERVICE":
                return anyContains(text, "客服", "customer", "售后") ? 2 : 1;
            default:
                return 1;
        }
    }

    // =============================================================== internal: report

    private CollaborationReport buildReport(CollaborationTask task,
                                             OffsetDateTime execStart,
                                             OffsetDateTime execEnd) {
        // 每员工贡献
        Map<String, Contribution> perEmployee = new LinkedHashMap<>();
        for (SubTask st : task.getSubtasks()) {
            Contribution c = perEmployee.computeIfAbsent(st.getEmployeeId(),
                    eid -> Contribution.builder().employeeId(eid).build());
            c.setSubtaskCount(c.getSubtaskCount() + 1);
            if (SUB_COMPLETED.equals(st.getStatus())) {
                c.setCompletedCount(c.getCompletedCount() + 1);
                c.setTotalSeconds(c.getTotalSeconds() + st.getActualSeconds());
            } else if (SUB_FAILED.equals(st.getStatus())) {
                c.setFailedCount(c.getFailedCount() + 1);
            }
        }

        long parallelSeconds = Math.max(0, Duration.between(execStart, execEnd).getSeconds());
        int sequentialSeconds = task.getSubtasks().stream()
                .mapToInt(st -> st.getActualSeconds() > 0 ? st.getActualSeconds() : st.getEstimatedSeconds())
                .sum();

        double efficiency = 0.0;
        if (sequentialSeconds > 0) {
            efficiency = Math.round((sequentialSeconds - parallelSeconds) * 100.0 / sequentialSeconds * 100.0) / 100.0;
        }

        int totalSubtasks = task.getSubtasks().size();
        int completed = (int) task.getSubtasks().stream().filter(st -> SUB_COMPLETED.equals(st.getStatus())).count();
        int failed = (int) task.getSubtasks().stream().filter(st -> SUB_FAILED.equals(st.getStatus())).count();

        // Markdown 报告
        List<String> lines = new ArrayList<>();
        lines.add("# 协作报告：" + task.getTitle());
        lines.add("");
        lines.add("**目标**：" + task.getGoal());
        lines.add("**状态**：" + task.getStatus());
        lines.add("**子任务**：" + completed + "/" + totalSubtasks + " 已完成，" + failed + " 失败");
        lines.add("**并行耗时**：" + parallelSeconds + "s（顺序执行预估 " + sequentialSeconds + "s）");
        lines.add("**效率提升**：" + efficiency + "%");
        lines.add("");
        lines.add("## 各员工贡献");
        lines.add("| 员工 | 子任务数 | 已完成 | 失败 | 累计耗时 |");
        lines.add("| --- | --- | --- | --- | --- |");
        for (Contribution c : perEmployee.values()) {
            lines.add("| " + c.getEmployeeId() + " | " + c.getSubtaskCount() + " | "
                    + c.getCompletedCount() + " | " + c.getFailedCount() + " | " + c.getTotalSeconds() + "s |");
        }
        lines.add("");
        lines.add("## 子任务执行明细");
        for (SubTask st : task.getSubtasks()) {
            int duration = st.getActualSeconds() > 0 ? st.getActualSeconds() : st.getEstimatedSeconds();
            lines.add("- `" + st.getId() + "` " + st.getTitle() + "（" + st.getEmployeeId() + "）"
                    + " → " + st.getStatus() + "，" + duration + "s");
        }

        return CollaborationReport.builder()
                .collaborationId(task.getCollaborationId())
                .title(task.getTitle())
                .goal(task.getGoal())
                .status(task.getStatus())
                .totalDurationSeconds((int) parallelSeconds)
                .totalSubtasks(totalSubtasks)
                .completedSubtasks(completed)
                .failedSubtasks(failed)
                .sequentialDurationSeconds(sequentialSeconds)
                .parallelDurationSeconds((int) parallelSeconds)
                .efficiencyImprovementPct(efficiency)
                .contributions(new ArrayList<>(perEmployee.values()))
                .finalReport(String.join("\n", lines))
                .build();
    }

    // =============================================================== internal: utils

    private List<SubTask> topologicalOrder(List<SubTask> subtasks) {
        Map<String, SubTask> byId = subtasks.stream()
                .collect(Collectors.toMap(SubTask::getId, s -> s, (a, b) -> a));
        Set<String> visited = new HashSet<>();
        List<SubTask> order = new ArrayList<>();

        for (SubTask st : subtasks) {
            visit(st, byId, visited, order);
        }
        return order;
    }

    private void visit(SubTask st, Map<String, SubTask> byId, Set<String> visited, List<SubTask> order) {
        if (visited.contains(st.getId())) {
            return;
        }
        visited.add(st.getId());
        if (st.getDependsOn() != null) {
            for (String dep : st.getDependsOn()) {
                SubTask depTask = byId.get(dep);
                if (depTask != null) {
                    visit(depTask, byId, visited, order);
                }
            }
        }
        order.add(st);
    }

    private SubTask findById(List<SubTask> subtasks, String id) {
        return subtasks.stream().filter(s -> id.equals(s.getId())).findFirst().orElse(null);
    }

    private SubTask copySubTask(SubTask s) {
        return SubTask.builder()
                .id(s.getId())
                .employeeId(s.getEmployeeId())
                .title(s.getTitle())
                .description(s.getDescription())
                .skillTags(s.getSkillTags())
                .status(s.getStatus())
                .progress(s.getProgress())
                .dependsOn(s.getDependsOn())
                .estimatedSeconds(s.getEstimatedSeconds())
                .actualSeconds(s.getActualSeconds())
                .result(s.getResult())
                .errorMessage(s.getErrorMessage())
                .startedAt(s.getStartedAt())
                .completedAt(s.getCompletedAt())
                .build();
    }

    private static boolean anyContains(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw.toLowerCase())) return true;
        }
        return false;
    }

    private static String tenantKey(String tenantId, String collaborationId) {
        return tenantId + ":" + collaborationId;
    }

    // =============================================================== static data

    private static final Map<String, List<String>> SKILL_KEYWORD_MAP = Map.ofEntries(
            Map.entry("财务", List.of("FINANCE")),
            Map.entry("发票", List.of("FINANCE")),
            Map.entry("报销", List.of("FINANCE")),
            Map.entry("预算", List.of("FINANCE")),
            Map.entry("成本", List.of("FINANCE")),
            Map.entry("对账", List.of("FINANCE")),
            Map.entry("人事", List.of("HR")),
            Map.entry("招聘", List.of("HR")),
            Map.entry("员工", List.of("HR")),
            Map.entry("考勤", List.of("HR")),
            Map.entry("薪资", List.of("HR")),
            Map.entry("法务", List.of("LEGAL")),
            Map.entry("合同", List.of("LEGAL")),
            Map.entry("合规", List.of("LEGAL")),
            Map.entry("审核", List.of("LEGAL")),
            Map.entry("数据", List.of("DATA_ANALYST")),
            Map.entry("分析", List.of("DATA_ANALYST")),
            Map.entry("统计", List.of("DATA_ANALYST")),
            Map.entry("报表", List.of("DATA_ANALYST")),
            Map.entry("日报", List.of("DATA_ANALYST")),
            Map.entry("周报", List.of("DATA_ANALYST")),
            Map.entry("月报", List.of("DATA_ANALYST")),
            Map.entry("报告", List.of("DATA_ANALYST")),
            Map.entry("客户", List.of("CUSTOMER_SERVICE")),
            Map.entry("客服", List.of("CUSTOMER_SERVICE")),
            Map.entry("售后", List.of("CUSTOMER_SERVICE")),
            Map.entry("回访", List.of("CUSTOMER_SERVICE")),
            Map.entry("邮件", List.of("FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE")),
            Map.entry("通知", List.of("FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE")),
            Map.entry("发送", List.of("FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE"))
    );

    private static final List<SubTaskTemplate> TEMPLATE_REPORT_WITH_EMAIL = List.of(
            new SubTaskTemplate("查询数据", "从业务系统拉取所需原始数据", "数据", 60, new int[0]),
            new SubTaskTemplate("数据分析", "对查询结果进行统计与趋势分析", "分析", 90, new int[]{0}),
            new SubTaskTemplate("生成报告", "汇总分析结果并生成结构化报告", "报告", 60, new int[]{1}),
            new SubTaskTemplate("发送邮件", "将报告通过邮件发送给相关人", "邮件", 30, new int[]{2}));

    private static final List<SubTaskTemplate> TEMPLATE_DATA_ANALYSIS = List.of(
            new SubTaskTemplate("查询数据", "从业务系统拉取所需原始数据", "数据", 60, new int[0]),
            new SubTaskTemplate("数据分析", "对查询结果进行统计与趋势分析", "分析", 90, new int[]{0}),
            new SubTaskTemplate("生成报告", "汇总分析结果并生成结构化报告", "报告", 60, new int[]{1}));

    private static final List<SubTaskTemplate> TEMPLATE_CUSTOMER_CHURN = List.of(
            new SubTaskTemplate("查询客户数据", "拉取客户基础信息与行为数据", "客户", 60, new int[0]),
            new SubTaskTemplate("分析流失原因", "使用统计模型识别流失关键因子", "分析", 120, new int[]{0}),
            new SubTaskTemplate("生成分析报告", "输出流失原因分析与建议", "报告", 60, new int[]{1}));

    private static final List<SubTaskTemplate> TEMPLATE_EMAIL_ONLY = List.of(
            new SubTaskTemplate("准备内容", "基于需求准备邮件正文与附件", "通知", 45, new int[0]),
            new SubTaskTemplate("发送邮件", "通过邮件服务发送给目标收件人", "邮件", 30, new int[]{0}));

    private static final List<SubTaskTemplate> TEMPLATE_DEFAULT = List.of(
            new SubTaskTemplate("理解需求", "解析任务意图与约束", "数据", 30, new int[0]),
            new SubTaskTemplate("执行任务", "调用相关工具完成主体任务", "分析", 90, new int[]{0}),
            new SubTaskTemplate("返回结果", "整理结果并返回给调用方", "报告", 30, new int[]{1}));
}
