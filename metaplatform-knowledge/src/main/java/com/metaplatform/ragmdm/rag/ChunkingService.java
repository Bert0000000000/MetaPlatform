package com.metaplatform.ragmdm.rag;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ChunkingService {

    @Value("${metaplatform.rag.default-chunk-size:512}")
    private int defaultChunkSize;

    @Value("${metaplatform.rag.default-chunk-overlap:50}")
    private int defaultChunkOverlap;

    /**
     * 将文本分块 (固定大小 + 重叠)
     */
    public List<ChunkResult> chunk(String content, int chunkSize, int chunkOverlap) {
        if (content == null || content.isBlank()) {
            return List.of();
        }

        if (chunkSize <= 0) chunkSize = defaultChunkSize;
        if (chunkOverlap < 0) chunkOverlap = defaultChunkOverlap;
        if (chunkOverlap >= chunkSize) chunkOverlap = chunkSize / 4;

        List<ChunkResult> chunks = new ArrayList<>();
        int position = 0;
        int chunkIndex = 0;

        while (position < content.length()) {
            int end = Math.min(position + chunkSize, content.length());

            // 尝试在句子边界断开
            if (end < content.length()) {
                int adjustedEnd = findSentenceBoundary(content, end, chunkSize / 4);
                if (adjustedEnd > position) {
                    end = adjustedEnd;
                }
            }

            String chunkContent = content.substring(position, end).trim();

            if (!chunkContent.isBlank()) {
                chunks.add(new ChunkResult(chunkIndex++, chunkContent, position, end));
            }

            // 下一个块的起始位置 (考虑重叠)
            int nextPosition = end - chunkOverlap;
            if (nextPosition <= position) {
                position = end; // 防止死循环
            } else {
                position = nextPosition;
            }
        }

        return chunks;
    }

    /**
     * 使用默认参数分块
     */
    public List<ChunkResult> chunk(String content) {
        return chunk(content, defaultChunkSize, defaultChunkOverlap);
    }

    /**
     * 智能分块: 按段落优先, 再按大小切分
     */
    public List<ChunkResult> smartChunk(String content, int chunkSize, int chunkOverlap) {
        if (content == null || content.isBlank()) return List.of();

        if (chunkSize <= 0) chunkSize = defaultChunkSize;
        if (chunkOverlap < 0) chunkOverlap = defaultChunkOverlap;

        // 1. 先按段落分割
        String[] paragraphs = content.split("\\n\\s*\\n");
        List<ChunkResult> chunks = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();
        int chunkIndex = 0;
        int globalPosition = 0;

        for (String paragraph : paragraphs) {
            paragraph = paragraph.trim();
            if (paragraph.isEmpty()) {
                globalPosition += 2; // account for \n\n
                continue;
            }

            // 如果当前 buffer + 新段落 超过 chunkSize, 先输出 buffer
            if (buffer.length() + paragraph.length() > chunkSize && buffer.length() > 0) {
                String chunkContent = buffer.toString().trim();
                int startPos = globalPosition - chunkContent.length();
                chunks.add(new ChunkResult(chunkIndex++, chunkContent, startPos, globalPosition));
                buffer.setLength(0);
            }

            // 如果单个段落超过 chunkSize, 按固定大小切割
            if (paragraph.length() > chunkSize) {
                if (buffer.length() > 0) {
                    String chunkContent = buffer.toString().trim();
                    int startPos = globalPosition - chunkContent.length();
                    chunks.add(new ChunkResult(chunkIndex++, chunkContent, startPos, globalPosition));
                    buffer.setLength(0);
                }

                List<ChunkResult> subChunks = chunk(paragraph, chunkSize, chunkOverlap);
                for (ChunkResult sub : subChunks) {
                    chunks.add(new ChunkResult(chunkIndex++, sub.content(),
                        globalPosition + sub.startPosition(), globalPosition + sub.endPosition()));
                }
                globalPosition += paragraph.length() + 2;
                continue;
            }

            buffer.append(paragraph).append("\n\n");
            globalPosition += paragraph.length() + 2;
        }

        // 输出剩余 buffer
        if (buffer.length() > 0) {
            String chunkContent = buffer.toString().trim();
            int startPos = globalPosition - chunkContent.length();
            chunks.add(new ChunkResult(chunkIndex++, chunkContent, startPos, globalPosition));
        }

        return chunks;
    }

    /**
     * 在指定位置附近查找句子边界
     */
    private int findSentenceBoundary(String content, int position, int maxLookback) {
        int start = Math.max(0, position - maxLookback);
        int searchEnd = Math.min(position + maxLookback, content.length());
        String searchArea = content.substring(start, searchEnd);

        char[] terminators = {'.', '!', '?', '\n', '\u3002', '\uff01', '\uff1f'};
        int bestOffset = -1;
        int targetOffset = position - start;

        for (char c : terminators) {
            int idx = searchArea.indexOf(c, Math.max(0, targetOffset - maxLookback / 2));
            if (idx >= 0) {
                if (bestOffset < 0 ||
                    Math.abs(idx - targetOffset) < Math.abs(bestOffset - targetOffset)) {
                    bestOffset = idx;
                }
            }
        }

        return bestOffset >= 0 ? start + bestOffset + 1 : position;
    }

    /**
     * 分块结果
     */
    public record ChunkResult(
        int index,
        String content,
        int startPosition,
        int endPosition
    ) {}
}
