package com.metaplatform.dialogue.domain.conversation;

/**
 * 会话状态枚举。
 */
public enum ConversationStatus {
    /** 活跃中 */
    ACTIVE,
    /** 已等待用户输入 */
    WAITING,
    /** 已关闭 */
    CLOSED,
    /** 已超时 */
    TIMED_OUT
}
