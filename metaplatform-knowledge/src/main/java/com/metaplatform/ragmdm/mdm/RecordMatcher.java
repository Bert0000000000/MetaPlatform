package com.metaplatform.ragmdm.mdm;

import com.metaplatform.ragmdm.common.JsonUtils;
import com.metaplatform.ragmdm.domain.GoldenRecord;
import com.metaplatform.ragmdm.domain.enums.GoldenRecordStatus;
import com.metaplatform.ragmdm.domain.repository.GoldenRecordRepository;
import lombok.RequiredArgsConstructor;
import me.xdrop.fuzzywuzzy.FuzzySearch;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecordMatcher {

    private final GoldenRecordRepository goldenRecordRepository;

    @Value("${metaplatform.mdm.match-threshold:80}")
    private int matchThreshold;

    /**
     * 查找可能匹配的黄金记录
     */
    public List<RecordMatchResult> findMatches(String entityType, Map<String, Object> sourceData) {
        List<GoldenRecord> candidates = goldenRecordRepository
            .findByEntityTypeAndStatus(entityType, GoldenRecordStatus.ACTIVE);

        List<RecordMatchResult> results = new ArrayList<>();

        for (GoldenRecord candidate : candidates) {
            Map<String, Object> goldenData = JsonUtils.toMap(candidate.getDataJson());
            if (goldenData == null) continue;

            int score = calculateMatchScore(sourceData, goldenData);
            if (score >= matchThreshold) {
                results.add(new RecordMatchResult(
                    candidate.getId(), score, determineRule(sourceData, goldenData)));
            }
        }

        // 按分数降序
        results.sort(Comparator.comparingInt(RecordMatchResult::getScore).reversed());
        return results;
    }

    /**
     * 计算匹配分数 (0-100)
     */
    int calculateMatchScore(Map<String, Object> source, Map<String, Object> golden) {
        int totalScore = 0;
        int fieldCount = 0;

        Map<String, Integer> fieldWeights = Map.of(
            "name", 30,
            "email", 25,
            "phone", 20,
            "company", 15,
            "address", 10
        );

        for (Map.Entry<String, Integer> weight : fieldWeights.entrySet()) {
            String field = weight.getKey();
            int w = weight.getValue();

            Object sourceVal = source.get(field);
            Object goldenVal = golden.get(field);

            if (sourceVal == null && goldenVal == null) continue;
            if (sourceVal == null || goldenVal == null) {
                fieldCount += w;
                continue;
            }

            String sv = sourceVal.toString().trim().toLowerCase();
            String gv = goldenVal.toString().trim().toLowerCase();

            if (sv.equals(gv)) {
                totalScore += w;
            } else {
                int fuzzyScore = FuzzySearch.ratio(sv, gv);
                totalScore += (int) (w * fuzzyScore / 100.0);
            }
            fieldCount += w;
        }

        return fieldCount > 0 ? Math.round((float) totalScore / fieldCount * 100) : 0;
    }

    private String determineRule(Map<String, Object> source, Map<String, Object> golden) {
        if (equalsIgnoreCase(source.get("email"), golden.get("email"))) return "EMAIL_MATCH";
        if (equalsIgnoreCase(source.get("phone"), golden.get("phone"))) return "PHONE_MATCH";
        if (equalsIgnoreCase(source.get("name"), golden.get("name"))) return "NAME_MATCH";
        return "FUZZY_MATCH";
    }

    private boolean equalsIgnoreCase(Object a, Object b) {
        if (a == null || b == null) return false;
        return a.toString().trim().equalsIgnoreCase(b.toString().trim());
    }
}
