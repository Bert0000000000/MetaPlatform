package com.metaplatform.ragmdm.mdm;

import com.metaplatform.ragmdm.common.JsonUtils;
import com.metaplatform.ragmdm.domain.GoldenRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MergeServiceTest {

    private MergeService mergeService;

    @BeforeEach
    void setUp() {
        mergeService = new MergeService();
    }

    @Test
    void masterWinsShouldNotOverrideExisting() {
        Map<String, Object> golden = new HashMap<>();
        golden.put("name", "Original Name");
        golden.put("email", "original@example.com");

        Map<String, Object> source = new HashMap<>();
        source.put("name", "New Name");
        source.put("email", "new@example.com");
        source.put("phone", "1234567890");

        String result = mergeService.mergeMasterWins(golden, source);
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("Original Name", merged.get("name"));
        assertEquals("original@example.com", merged.get("email"));
        assertEquals("1234567890", merged.get("phone"));
    }

    @Test
    void masterWinsShouldFillBlanks() {
        Map<String, Object> golden = new HashMap<>();
        golden.put("name", "John");
        golden.put("email", "");

        Map<String, Object> source = new HashMap<>();
        source.put("email", "john@example.com");

        String result = mergeService.mergeMasterWins(golden, source);
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("John", merged.get("name"));
        assertEquals("john@example.com", merged.get("email"));
    }

    @Test
    void latestWinsShouldOverride() {
        Map<String, Object> golden = new HashMap<>();
        golden.put("name", "Old Name");
        golden.put("email", "old@example.com");

        Map<String, Object> source = new HashMap<>();
        source.put("name", "New Name");
        source.put("phone", "1234567890");

        String result = mergeService.mergeLatestWins(golden, source);
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("New Name", merged.get("name"));
        assertEquals("old@example.com", merged.get("email"));
        assertEquals("1234567890", merged.get("phone"));
    }

    @Test
    void mostCompleteShouldChooseLongerValue() {
        Map<String, Object> golden = new HashMap<>();
        golden.put("address", "Beijing");

        Map<String, Object> source = new HashMap<>();
        source.put("address", "Beijing, Chaoyang District, Building A");

        String result = mergeService.mergeMostComplete(golden, source);
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("Beijing, Chaoyang District, Building A", merged.get("address"));
    }

    @Test
    void mergeUsesGoldenRecordStrategy() {
        GoldenRecord golden = new GoldenRecord();
        golden.setDataJson(JsonUtils.toJson(Map.of("name", "Old")));
        golden.setMergeStrategy("LATEST_WINS");

        String result = mergeService.merge(golden, Map.of("name", "New"));
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("New", merged.get("name"));
    }

    @Test
    void mergeDefaultsToMasterWins() {
        GoldenRecord golden = new GoldenRecord();
        golden.setDataJson(JsonUtils.toJson(Map.of("name", "Original")));
        golden.setMergeStrategy(null);

        String result = mergeService.merge(golden, Map.of("name", "Overwrite"));
        Map<String, Object> merged = JsonUtils.toMap(result);

        assertEquals("Original", merged.get("name"));
    }
}
