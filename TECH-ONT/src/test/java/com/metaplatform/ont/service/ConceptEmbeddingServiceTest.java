package com.metaplatform.ont.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConceptEmbeddingServiceTest {

    @Mock
    private VectorStore vectorStore;

    @InjectMocks
    private ConceptEmbeddingService service;

    @Captor
    private ArgumentCaptor<List<Document>> documentsCaptor;

    @Captor
    private ArgumentCaptor<SearchRequest> searchRequestCaptor;

    @Test
    void embedConcept_addsConceptDocumentToVectorStore() {
        service.embedConcept("customer", "客户", "购买产品的个人或组织", List.of("顾客", "买方"));

        verify(vectorStore).add(documentsCaptor.capture());
        Document document = documentsCaptor.getValue().getFirst();
        assertThat(document.getId()).isEqualTo("customer");
        assertThat(document.getText()).isEqualTo("客户 (customer): 购买产品的个人或组织. 别名: 顾客, 买方");
        assertThat(document.getMetadata()).containsAllEntriesOf(Map.of(
                "conceptId", "customer",
                "name", "客户",
                "type", "concept"
        ));
    }

    @Test
    void searchSimilarConcepts_usesQueryAndTopK() {
        List<Document> expected = List.of(
                new Document("customer", "客户", Map.of("conceptId", "customer"))
        );
        when(vectorStore.similaritySearch(any(SearchRequest.class))).thenReturn(expected);

        List<Document> result = service.searchSimilarConcepts("客户", 5);

        verify(vectorStore).similaritySearch(searchRequestCaptor.capture());
        assertThat(searchRequestCaptor.getValue().getQuery()).isEqualTo("客户");
        assertThat(searchRequestCaptor.getValue().getTopK()).isEqualTo(5);
        assertThat(result).isSameAs(expected);
    }
}
