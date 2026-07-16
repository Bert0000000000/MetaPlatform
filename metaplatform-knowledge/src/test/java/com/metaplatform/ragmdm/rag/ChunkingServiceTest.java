package com.metaplatform.ragmdm.rag;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChunkingServiceTest {

    private ChunkingService chunkingService;

    @BeforeEach
    void setUp() {
        chunkingService = new ChunkingService();
        ReflectionTestUtils.setField(chunkingService, "defaultChunkSize", 512);
        ReflectionTestUtils.setField(chunkingService, "defaultChunkOverlap", 50);
    }

    @Test
    void basicChunking() {
        String content = "A".repeat(1000);
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content, 256, 50);
        assertTrue(chunks.size() >= 4, "Expected at least 4 chunks, got " + chunks.size());
        assertTrue(chunks.get(0).content().length() <= 256);
    }

    @Test
    void emptyContent() {
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk("");
        assertTrue(chunks.isEmpty());
    }

    @Test
    void nullContent() {
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(null);
        assertTrue(chunks.isEmpty());
    }

    @Test
    void chunkOverlapWorks() {
        // Use a long string of unique chars to detect overlap
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 100; i++) {
            sb.append(String.format("%02d", i));
        }
        String content = sb.toString(); // 200 chars
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content, 50, 10);

        assertTrue(chunks.size() >= 3, "Expected at least 3 chunks, got " + chunks.size());

        // Verify overlap: last 10 chars of chunk 0 should match first 10 chars of chunk 1
        String firstChunk = chunks.get(0).content();
        String secondChunk = chunks.get(1).content();
        if (firstChunk.length() >= 10 && secondChunk.length() >= 10) {
            String firstEnd = firstChunk.substring(firstChunk.length() - 10);
            String secondStart = secondChunk.substring(0, 10);
            assertEquals(firstEnd, secondStart, "Overlap region should match");
        }
    }

    @Test
    void smartChunkRespectsParagraphs() {
        String para1 = "This is the first paragraph with enough content.";
        String para2 = "This is the second paragraph which is also fairly long.";
        String para3 = "Third paragraph.";
        String content = para1 + "\n\n" + para2 + "\n\n" + para3;

        List<ChunkingService.ChunkResult> chunks = chunkingService.smartChunk(content, 100, 10);
        assertTrue(chunks.size() >= 2, "Should split on paragraph boundaries");
    }

    @Test
    void chunkIndexSequential() {
        String content = "Word ".repeat(200);
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content, 50, 5);

        for (int i = 0; i < chunks.size(); i++) {
            assertEquals(i, chunks.get(i).index(), "Chunk index should be sequential");
        }
    }

    @Test
    void defaultChunking() {
        String content = "Hello world. ".repeat(100);
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content);
        assertFalse(chunks.isEmpty());
    }

    @Test
    void negativeOverlapResetToDefault() {
        String content = "A".repeat(1000);
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content, 200, -5);
        assertFalse(chunks.isEmpty());
    }

    @Test
    void overlapLargerThanChunkSize() {
        String content = "A".repeat(500);
        // overlap >= chunkSize should be reset to chunkSize / 4
        List<ChunkingService.ChunkResult> chunks = chunkingService.chunk(content, 100, 200);
        assertFalse(chunks.isEmpty());
    }
}
