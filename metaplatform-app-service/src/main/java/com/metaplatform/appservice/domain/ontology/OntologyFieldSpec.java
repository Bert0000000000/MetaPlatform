package com.metaplatform.appservice.domain.ontology;

/**
 * ontology-engine 字段类型 spec（与 ontology-engine 本地约定对齐）。
 */
public record OntologyFieldSpec(String name, String displayName, String type, boolean required) {}
