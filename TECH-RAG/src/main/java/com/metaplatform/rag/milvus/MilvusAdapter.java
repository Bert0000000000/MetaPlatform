package com.metaplatform.rag.milvus;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class MilvusAdapter {
    public MilvusAdapter() { log.warn("[MilvusAdapter] STUB - full impl deferred to P2.2.3"); }
    public java.util.List<String> search(String collection, java.util.List<Float> vector, int topK) { return java.util.List.of(); }
    public void insert(String collection, java.util.List<java.util.Map<String,Object>> records) { /* noop */ }
    public void createCollectionIfMissing(String name, int dim) { /* noop */ }
}
