package com.metaplatform.dw.service;

import com.metaplatform.dw.config.DwProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.*;

/**
 * 在应用启动时检查并创建 9 个预置 PAGE_SPECIFIC 类型 Agent。
 * 幂等：通过 name 精确匹配检查，存在则跳过。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PresetAgentInitializer implements ApplicationRunner {
    private final WebClient.Builder builder;
    private final DwProperties properties;

    private static final List<Map<String, Object>> PRESETS = List.of(
            Map.of("name", "工作台专属 Agent", "module", "dashboard", "page", "home"),
            Map.of("name", "应用建模专属 Agent", "module", "apphub", "page", "modeling"),
            Map.of("name", "流程设计专属 Agent", "module", "apphub", "page", "workflow"),
            Map.of("name", "本体建模专属 Agent", "module", "ontstudio", "page", "modeling"),
            Map.of("name", "概念抽取专属 Agent", "module", "kb", "page", "extraction"),
            Map.of("name", "MCP 调试专属 Agent", "module", "mcphub", "page", "debug"),
            Map.of("name", "业务 RAG 专属 Agent", "module", "kb", "page", "rag"),
            Map.of("name", "数字员工配置专属 Agent", "module", "dw", "page", "config"),
            Map.of("name", "架构梳理专属 Agent", "module", "arch", "page", "overview")
    );

    @Override
    public void run(ApplicationArguments args) {
        WebClient client = builder.clone().baseUrl(properties.getAgentBaseUrl()).build();
        try {
            List<Map<String, Object>> existing = client.get().uri("/api/v1/agent/employees")
                    .retrieve().bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                    .onErrorReturn(List.of()).block();
            Set<String> existingNames = new HashSet<>();
            if (existing != null) {
                for (Map<String, Object> emp : existing) {
                    Object name = emp.get("name");
                    if (name != null) existingNames.add(name.toString());
                }
            }
            for (Map<String, Object> preset : PRESETS) {
                String name = (String) preset.get("name");
                if (existingNames.contains(name)) {
                    log.info("PresetAgent: {} 已存在，跳过", name);
                    continue;
                }
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("name", name);
                body.put("type", "PAGE_SPECIFIC");
                body.put("module", preset.get("module"));
                body.put("page", preset.get("page"));
                body.put("pageContext", Map.of(
                        "module", preset.get("module"),
                        "page", preset.get("page"),
                        "userAction", "INIT"
                ));
                body.put("description", "系统预置 " + name + "，随 APP-DW 启动自动创建");
                body.put("systemPreset", true);
                try {
                    client.post().uri("/api/v1/agent/employees").bodyValue(body).retrieve().bodyToMono(Object.class).block();
                    log.info("PresetAgent: 已创建 {}", name);
                } catch (Exception ex) {
                    log.warn("PresetAgent: 创建 {} 失败: {}", name, ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.warn("PresetAgent: 启动初始化失败(可能 TECH-AGENT 未启动): {}", ex.getMessage());
        }
    }
}