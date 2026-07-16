package com.metaplatform.capability.domain;

/**
 * 能力分类类型。
 */
public enum CapabilityType {
    /** 通信类（邮件、短信、通知） */
    COMMUNICATION,
    /** AI 类（摘要、翻译、分类） */
    AI,
    /** 文件处理类（PDF、导出） */
    FILE,
    /** 网络类（HTTP请求） */
    NETWORK,
    /** 数据处理类（验证、转换） */
    DATA,
    /** 其他 */
    OTHER
}
