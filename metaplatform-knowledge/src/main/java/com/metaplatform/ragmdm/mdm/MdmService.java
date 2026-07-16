package com.metaplatform.ragmdm.mdm;

import com.metaplatform.ragmdm.common.JsonUtils;
import com.metaplatform.ragmdm.common.exception.ResourceNotFoundException;
import com.metaplatform.ragmdm.domain.GoldenRecord;
import com.metaplatform.ragmdm.domain.RecordLink;
import com.metaplatform.ragmdm.domain.enums.GoldenRecordStatus;
import com.metaplatform.ragmdm.domain.repository.GoldenRecordRepository;
import com.metaplatform.ragmdm.domain.repository.RecordLinkRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MdmService {

    private final GoldenRecordRepository goldenRecordRepository;
    private final RecordLinkRepository recordLinkRepository;
    private final RecordMatcher recordMatcher;
    private final MergeService mergeService;

    @Value("${metaplatform.mdm.auto-merge-threshold:95}")
    private int autoMergeThreshold;

    /**
     * 创建或更新黄金记录
     */
    @Transactional
    public GoldenRecord upsert(String entityType, String sourceSystem,
                                String sourceId, Map<String, Object> sourceData) {
        // 1. 精确匹配 sourceSystem + sourceId
        List<RecordLink> existingLinks = recordLinkRepository
            .findBySourceSystemAndSourceId(sourceSystem, sourceId);

        if (!existingLinks.isEmpty()) {
            RecordLink link = existingLinks.get(0);
            GoldenRecord golden = goldenRecordRepository
                .findById(link.getGoldenRecordId()).orElseThrow();

            link.setSourceData(JsonUtils.toJson(sourceData));
            recordLinkRepository.save(link);

            golden.setDataJson(mergeService.merge(golden, sourceData));
            golden.setUpdatedAt(LocalDateTime.now());
            return goldenRecordRepository.save(golden);
        }

        // 2. 模糊匹配
        List<RecordMatchResult> matches = recordMatcher.findMatches(entityType, sourceData);

        if (!matches.isEmpty()) {
            RecordMatchResult bestMatch = matches.get(0);

            if (bestMatch.getScore() >= autoMergeThreshold) {
                return autoMerge(bestMatch, sourceSystem, sourceId, sourceData);
            } else if (bestMatch.getScore() >= 80) {
                return linkWithReview(bestMatch, sourceSystem, sourceId, sourceData);
            }
        }

        // 3. 无匹配: 创建新记录
        return createGoldenRecord(entityType, sourceSystem, sourceId, sourceData);
    }

    private GoldenRecord autoMerge(RecordMatchResult match, String sourceSystem,
                                    String sourceId, Map<String, Object> sourceData) {
        GoldenRecord golden = goldenRecordRepository
            .findById(match.getGoldenRecordId()).orElseThrow();

        RecordLink link = new RecordLink();
        link.setGoldenRecordId(golden.getId());
        link.setSourceSystem(sourceSystem);
        link.setSourceId(sourceId);
        link.setSourceData(JsonUtils.toJson(sourceData));
        link.setMatchScore(match.getScore());
        link.setMatchRule(match.getRuleName());
        recordLinkRepository.save(link);

        golden.setDataJson(mergeService.merge(golden, sourceData));
        golden.setSourceCount(golden.getSourceCount() + 1);
        golden.setUpdatedAt(LocalDateTime.now());
        return goldenRecordRepository.save(golden);
    }

    private GoldenRecord linkWithReview(RecordMatchResult match, String sourceSystem,
                                         String sourceId, Map<String, Object> sourceData) {
        GoldenRecord golden = goldenRecordRepository
            .findById(match.getGoldenRecordId()).orElseThrow();

        RecordLink link = new RecordLink();
        link.setGoldenRecordId(golden.getId());
        link.setSourceSystem(sourceSystem);
        link.setSourceId(sourceId);
        link.setSourceData(JsonUtils.toJson(sourceData));
        link.setMatchScore(match.getScore());
        link.setMatchRule(match.getRuleName());
        recordLinkRepository.save(link);

        golden.setStatus(GoldenRecordStatus.MERGING);
        golden.setUpdatedAt(LocalDateTime.now());
        return goldenRecordRepository.save(golden);
    }

    private GoldenRecord createGoldenRecord(String entityType, String sourceSystem,
                                              String sourceId, Map<String, Object> sourceData) {
        GoldenRecord golden = new GoldenRecord();
        golden.setEntityType(entityType);
        golden.setEntityCode(entityType + "_" + UUID.randomUUID().toString().substring(0, 8));
        golden.setDataJson(JsonUtils.toJson(sourceData));
        golden.setStatus(GoldenRecordStatus.ACTIVE);
        golden.setMatchScore(100);
        golden.setSourceCount(1);
        golden.setMergeStrategy("MASTER_WINS");
        golden.setCreatedBy("system");
        golden = goldenRecordRepository.save(golden);

        RecordLink link = new RecordLink();
        link.setGoldenRecordId(golden.getId());
        link.setSourceSystem(sourceSystem);
        link.setSourceId(sourceId);
        link.setSourceData(JsonUtils.toJson(sourceData));
        link.setMatchScore(100);
        link.setMatchRule("NEW_RECORD");
        recordLinkRepository.save(link);

        return golden;
    }

    public Page<GoldenRecord> list(String entityType, Pageable pageable) {
        if (entityType != null) {
            return goldenRecordRepository.findByEntityType(entityType, pageable);
        }
        return goldenRecordRepository.findAll(pageable);
    }

    public GoldenRecordDetail getDetail(Long id) {
        GoldenRecord golden = goldenRecordRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("GoldenRecord", id));
        List<RecordLink> links = recordLinkRepository.findByGoldenRecordId(id);

        GoldenRecordDetail detail = new GoldenRecordDetail();
        detail.setGoldenRecord(golden);
        detail.setSourceRecords(links);
        return detail;
    }

    // === DTO ===
    @Data
    public static class GoldenRecordDetail {
        private GoldenRecord goldenRecord;
        private List<RecordLink> sourceRecords;
    }
}
