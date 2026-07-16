package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.message.Message;

import java.util.List;

/**
 * 回复生成器接口。基于意图和上下文生成回复消息。
 */
public interface ResponseGenerator {
    /**
     * 根据识别到的意图和历史消息生成回复。
     *
     * @param conversation 当前会话
     * @param intent 识别到的意图
     * @param history 历史消息
     * @return 生成的回复文本
     */
    String generate(Conversation conversation, Intent intent, List<Message> history);
}
