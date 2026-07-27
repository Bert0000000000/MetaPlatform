package com.metaplatform.a2a.delegation;

/**
 * 委派任务状态枚举（V14-06 状态机）。
 *
 * <p>对应 Python {@code app.delegation.schemas.TaskStatus}。
 * 状态机流转规则：
 * <pre>
 *   PENDING → SUBMITTED → WORKING → COMPLETED
 *                     ↓           ↓
 *              INPUT_REQUIRED   FAILED
 *                     ↓
 *                 CANCELED / CANCELLED
 * </pre></p>
 */
public enum TaskStatus {

    /** 初始状态：任务已创建但尚未提交到目标 Agent。 */
    PENDING("PENDING"),

    /** 已提交到目标 Agent。 */
    SUBMITTED("SUBMITTED"),

    /** 目标 Agent 正在执行。 */
    WORKING("WORKING"),

    /** 需要用户输入（等待回应）。 */
    INPUT_REQUIRED("INPUT_REQUIRED"),

    /** 已完成。 */
    COMPLETED("COMPLETED"),

    /** 执行失败。 */
    FAILED("FAILED"),

    /** 已取消（A2A 协议标准拼写）。 */
    CANCELED("CANCELED"),

    /** 已取消（替代拼写，兼容）。 */
    CANCELLED("CANCELLED"),

    /** 已拒绝（目标 Agent 拒绝执行）。 */
    REJECTED("REJECTED");

    private final String code;

    TaskStatus(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    /**
     * 判断状态是否为终态。
     */
    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == CANCELED
                || this == CANCELLED || this == REJECTED;
    }

    /**
     * 判断是否允许从当前状态转换到目标状态。
     */
    public boolean canTransitionTo(TaskStatus target) {
        if (this == target) {
            return true;
        }
        if (isTerminal()) {
            return false;
        }
        // 允许非终态向任意非终态或终态转换
        return target != null;
    }

    public static TaskStatus fromCode(String code) {
        if (code == null) {
            return PENDING;
        }
        for (TaskStatus s : values()) {
            if (s.code.equals(code)) {
                return s;
            }
        }
        return PENDING;
    }
}
