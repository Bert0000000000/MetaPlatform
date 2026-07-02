package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.intent.Intent;

/**
 * 自然语言解析器接口。将用户文本解析为结构化意图。
 */
public interface NaturalLanguageParser {
    /**
     * 解析用户输入文本，返回识别到的意图。
     *
     * @param text 用户输入文本
     * @return 识别到的意图
     */
    Intent parse(String text);
}
