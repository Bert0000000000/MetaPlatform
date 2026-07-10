package com.metaplatform.appservice.domain.ontology;

import java.util.List;

/**
 * ontology-engine 客户端接口 —— Sprint 1 接入。
 *
 * <p>v1.0.1 阶段直接复用 metaplatform-ontology-engine 的 ObjectTypeController
 * ({@code POST /api/v1/object-types})，详见同仓 {@code /metaplatform-ontology-engine}。
 */
public interface OntologyClient {
    /** 注册业务对象类型；返回 ontology-engine 分配的 ObjectType id。 */
    String createObjectType(String code, String name, List<OntologyFieldSpec> fields);

    /** 删除 ObjectType（用于回滚 / 物理删除对象时调用）。 */
    void dropObjectType(String objectTypeId);
}
