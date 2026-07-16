package com.metaplatform.ragmdm.mdm;

import com.metaplatform.ragmdm.domain.repository.GoldenRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class RecordMatcherTest {

    @Mock
    private GoldenRecordRepository goldenRecordRepository;

    @InjectMocks
    private RecordMatcher recordMatcher;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(recordMatcher, "matchThreshold", 80);
    }

    @Test
    void exactMatchShouldReturnHighScore() {
        Map<String, Object> source = Map.of(
            "name", "Zhang San",
            "email", "zhangsan@example.com",
            "phone", "13800138000"
        );
        Map<String, Object> golden = Map.of(
            "name", "Zhang San",
            "email", "zhangsan@example.com",
            "phone", "13800138000"
        );

        int score = recordMatcher.calculateMatchScore(source, golden);
        assertEquals(100, score);
    }

    @Test
    void fuzzyMatchShouldReturnReasonableScore() {
        Map<String, Object> source = Map.of(
            "name", "Zhang San",
            "email", "zhangsan@example.com",
            "phone", "13800138000"
        );
        Map<String, Object> golden = Map.of(
            "name", "Zhang San",   // exact
            "email", "zhangsan@example.com", // exact
            "phone", "13900139000"  // different
        );

        int score = recordMatcher.calculateMatchScore(source, golden);
        assertTrue(score >= 70, "Score should be at least 70 for 2/3 exact match, got " + score);
    }

    @Test
    void completelyDifferentShouldReturnLowScore() {
        Map<String, Object> source = Map.of(
            "name", "Alice",
            "email", "alice@example.com"
        );
        Map<String, Object> golden = Map.of(
            "name", "Bob",
            "email", "bob@example.com"
        );

        int score = recordMatcher.calculateMatchScore(source, golden);
        assertTrue(score < 50, "Score should be low for completely different data, got " + score);
    }

    @Test
    void nullFieldsShouldNotCrash() {
        Map<String, Object> source = Map.of(
            "name", "Test User"
        );
        Map<String, Object> golden = Map.of(
            "name", "Test User",
            "email", "test@example.com"
        );

        int score = recordMatcher.calculateMatchScore(source, golden);
        assertTrue(score > 0);
    }

    @Test
    void emptyMapsShouldReturnZero() {
        Map<String, Object> source = Map.of();
        Map<String, Object> golden = Map.of();

        int score = recordMatcher.calculateMatchScore(source, golden);
        assertEquals(0, score);
    }
}
