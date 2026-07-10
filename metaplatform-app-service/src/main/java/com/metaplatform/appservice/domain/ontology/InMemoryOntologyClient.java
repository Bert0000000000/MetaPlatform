package com.metaplatform.appservice.domain.ontology;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 测试内存实现 —— 让 Sprint 1 集成测试不依赖 ontology-engine :8090 / :8080 真实服务。
 */
@Component
@Profile("test")
public class InMemoryOntologyClient implements OntologyClient {

    @Override
    public String createObjectType(String code, String name, List<OntologyFieldSpec> fields) {
        return "ot-test-" + code;
    }

    @Override
    public void dropObjectType(String objectTypeId) {
        // no-op
    }
}
