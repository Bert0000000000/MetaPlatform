package com.metaplatform.llmgw.prompts;

import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Prompt 模板渲染服务：基于 SAA PromptTemplate。
 */
@Service
public class PromptTemplateService {

    public String render(String template, Map<String, Object> variables) {
        return new PromptTemplate(template).render(variables);
    }

    public String renderFromResource(String resourcePath, Map<String, Object> variables) {
        return new PromptTemplate(new ClassPathResource(resourcePath)).render(variables);
    }
}
