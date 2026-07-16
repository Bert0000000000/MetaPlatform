package com.metaplatform.appservice.domain.ontology;

import com.metaplatform.appservice.config.AppServiceProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * 默认的 ontology-engine 客户端实现：HTTP 调到 metaplatform-ontology-engine :8080/api/v1/object-types。
 *
 * <p>Sprint 1 阶段使用；测试时通过 {@link InMemoryOntologyClient} 替换。
 */
@Component
@Profile("!test")
public class RestOntologyClient implements OntologyClient {

    private final RestClient restClient;

    public RestOntologyClient(AppServiceProperties props) {
        this.restClient = RestClient.builder()
                .baseUrl(props.ontologyEngine().url())
                .build();
    }

    @Override
    public String createObjectType(String code, String name, List<OntologyFieldSpec> fields) {
        // Sprint 1：先用 stub（ontology-engine 还没在本环境运行；Sprint 5 联调时启用真实 HTTP）
        // 直接返回 "ot-mock-{code}"
        return "ot-" + code + "-" + System.currentTimeMillis();
    }

    @Override
    public void dropObjectType(String objectTypeId) {
        // 同上：Sprint 1 stub
    }
}
