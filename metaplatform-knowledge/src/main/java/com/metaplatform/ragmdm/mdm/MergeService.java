package com.metaplatform.ragmdm.mdm;

import com.metaplatform.ragmdm.common.JsonUtils;
import com.metaplatform.ragmdm.domain.GoldenRecord;
import com.metaplatform.ragmdm.domain.enums.MergeStrategy;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class MergeService {

    /**
     * 合并来源数据到黄金记录
     */
    public String merge(GoldenRecord golden, Map<String, Object> sourceData) {
        Map<String, Object> goldenData = JsonUtils.toMap(golden.getDataJson());
        if (goldenData == null) goldenData = new HashMap<>();

        MergeStrategy strategy = MergeStrategy.valueOf(
            golden.getMergeStrategy() != null ? golden.getMergeStrategy() : "MASTER_WINS");

        return switch (strategy) {
            case MASTER_WINS -> mergeMasterWins(goldenData, sourceData);
            case LATEST_WINS -> mergeLatestWins(goldenData, sourceData);
            case MOST_COMPLETE -> mergeMostComplete(goldenData, sourceData);
        };
    }

    /**
     * MASTER_WINS: 黄金记录优先, 只补充空字段
     */
    String mergeMasterWins(Map<String, Object> golden, Map<String, Object> source) {
        Map<String, Object> merged = new HashMap<>(golden);
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (!merged.containsKey(entry.getKey()) ||
                merged.get(entry.getKey()) == null ||
                merged.get(entry.getKey()).toString().isBlank()) {
                merged.put(entry.getKey(), entry.getValue());
            }
        }
        return JsonUtils.toJson(merged);
    }

    /**
     * LATEST_WINS: 来源数据覆盖
     */
    String mergeLatestWins(Map<String, Object> golden, Map<String, Object> source) {
        Map<String, Object> merged = new HashMap<>(golden);
        merged.putAll(source);
        return JsonUtils.toJson(merged);
    }

    /**
     * MOST_COMPLETE: 选择内容更完整的值
     */
    String mergeMostComplete(Map<String, Object> golden, Map<String, Object> source) {
        Map<String, Object> merged = new HashMap<>(golden);
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            Object existing = merged.get(entry.getKey());
            if (existing == null || existing.toString().length() < entry.getValue().toString().length()) {
                merged.put(entry.getKey(), entry.getValue());
            }
        }
        return JsonUtils.toJson(merged);
    }
}
