package com.metaplatform.wfe.engine.model;

import java.util.List;

/**
 * FlowGram.AI fixed-layout 文档根。
 * nodes 数组顺序 + blocks 子数组形成树形嵌套。
 */
public record FlowDocument(List<FlowNode> nodes) {
}
