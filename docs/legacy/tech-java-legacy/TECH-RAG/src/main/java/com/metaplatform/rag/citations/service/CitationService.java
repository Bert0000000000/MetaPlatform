package com.metaplatform.rag.citations.service;

import com.metaplatform.rag.citations.dto.CitationDto;
import com.metaplatform.rag.citations.dto.CitationLocateRequest;
import com.metaplatform.rag.citations.dto.CitationSourceDto;
import com.metaplatform.rag.entity.ChunkEntity;
import com.metaplatform.rag.repository.ChunkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CitationService {

    private final ChunkRepository chunkRepository;

    private static final Pattern CITATION_PATTERN = Pattern.compile("\\[?(\\d+)\\]?");

    @Transactional(readOnly = true)
    public List<CitationDto> locateCitations(CitationLocateRequest request) {
        List<CitationDto> results = new ArrayList<>();
        if (request.answer() == null || request.chunks() == null) {
            return results;
        }
        Matcher matcher = CITATION_PATTERN.matcher(request.answer());
        while (matcher.find()) {
            int index = Integer.parseInt(matcher.group(1)) - 1;
            if (index >= 0 && index < request.chunks().size()) {
                CitationSourceDto source = request.chunks().get(index);
                results.add(new CitationDto(source.chunkId(), source.docId(), source.content(), source.score()));
            }
        }
        return results;
    }

    @Transactional(readOnly = true)
    public CitationDto getCitation(UUID chunkId) {
        ChunkEntity chunk = chunkRepository.findById(chunkId)
            .orElseThrow(() -> new IllegalArgumentException("Chunk not found: " + chunkId));
        return new CitationDto(
            chunk.getId(),
            chunk.getDocId(),
            chunk.getContent(),
            0.0
        );
    }

    @Transactional(readOnly = true)
    public List<CitationDto> batchCitations(List<UUID> chunkIds) {
        return chunkIds.stream()
            .map(this::getCitation)
            .toList();
    }
}
