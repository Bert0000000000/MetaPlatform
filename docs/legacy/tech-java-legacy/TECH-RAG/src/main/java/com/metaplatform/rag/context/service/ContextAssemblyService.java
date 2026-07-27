package com.metaplatform.rag.context.service;

import com.metaplatform.rag.context.dto.ContextAssembleRequest;
import com.metaplatform.rag.context.dto.ContextAssembleResponse;
import com.metaplatform.rag.context.dto.ContextSource;
import com.metaplatform.rag.graph.dto.GraphSearchRequest;
import com.metaplatform.rag.graph.dto.GraphSearchResult;
import com.metaplatform.rag.graph.service.GraphSearchService;
import com.metaplatform.rag.search.dto.SearchRequest;
import com.metaplatform.rag.search.dto.SearchResult;
import com.metaplatform.rag.search.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ContextAssemblyService {

    private final SearchService searchService;
    private final GraphSearchService graphSearchService;

    @Transactional(readOnly = true)
    public ContextAssembleResponse assemble(ContextAssembleRequest request) {
        List<ContextSource> sources = new ArrayList<>();
        SearchRequest searchRequest = new SearchRequest(
            request.query(),
            5,
            0.7,
            0.5
        );

        if (request.kbIds() != null) {
            for (var kbId : request.kbIds()) {
                List<SearchResult> vectorResults = searchService.search(kbId, searchRequest).results();
                for (SearchResult r : vectorResults) {
                    sources.add(new ContextSource(
                        r.chunkId(),
                        r.docId(),
                        r.content(),
                        "vector",
                        r.score()
                    ));
                }

                if (Boolean.TRUE.equals(request.enableGraph())) {
                    GraphSearchRequest graphRequest = new GraphSearchRequest(request.query(), kbId, 3);
                    for (GraphSearchResult r : graphSearchService.search(graphRequest).results()) {
                        sources.add(new ContextSource(
                            r.chunkId(),
                            r.docId(),
                            r.content(),
                            "graph_" + r.relationType(),
                            r.score()
                        ));
                    }
                }
            }
        }

        StringBuilder contextBuilder = new StringBuilder();
        if (request.history() != null && !request.history().isEmpty()) {
            contextBuilder.append("History:\n");
            for (String h : request.history()) {
                contextBuilder.append(h).append("\n");
            }
            contextBuilder.append("\n");
        }
        contextBuilder.append("Retrieved Context:\n");
        int index = 1;
        for (ContextSource source : sources) {
            contextBuilder.append("[").append(index++).append("] ").append(source.content()).append("\n");
        }

        return new ContextAssembleResponse(contextBuilder.toString(), sources);
    }
}
