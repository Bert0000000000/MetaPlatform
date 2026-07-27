package com.metaplatform.gw.route.dynamic;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.gw.route.entity.GwRouteEntity;
import com.metaplatform.gw.route.repository.GwRouteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.FilterDefinition;
import org.springframework.cloud.gateway.handler.predicate.PredicateDefinition;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseRouteDefinitionRepository implements RouteDefinitionRepository {

    private final GwRouteRepository routeRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final TypeReference<List<Map<String, Object>>> listTypeRef = new TypeReference<>() {};

    @Override
    public Flux<RouteDefinition> getRouteDefinitions() {
        return Mono.fromCallable(() -> {
            List<GwRouteEntity> entities = routeRepository.findAllEnabledRoutes();
            List<RouteDefinition> definitions = new ArrayList<>();
            for (GwRouteEntity entity : entities) {
                try {
                    RouteDefinition definition = convertToRouteDefinition(entity);
                    if (definition != null) {
                        definitions.add(definition);
                    }
                } catch (Exception e) {
                    log.error("Failed to convert route: {}", entity.getRouteId(), e);
                }
            }
            return definitions;
        })
        .subscribeOn(Schedulers.boundedElastic())
        .onErrorResume(e -> {
            log.warn("Failed to load routes from database, returning empty list: {}", e.getMessage());
            return Mono.just(List.of());
        })
        .flatMapMany(Flux::fromIterable);
    }

    @Override
    public Mono<Void> save(Mono<RouteDefinition> route) {
        return route.doOnNext(definition -> {
            log.info("Save route definition requested for: {}", definition.getId());
        }).then();
    }

    @Override
    public Mono<Void> delete(Mono<String> routeId) {
        return routeId.doOnNext(id -> {
            log.info("Delete route definition requested for: {}", id);
        }).then();
    }

    @SuppressWarnings("unchecked")
    private RouteDefinition convertToRouteDefinition(GwRouteEntity entity) {
        try {
            RouteDefinition definition = new RouteDefinition();
            definition.setId(entity.getRouteId());
            definition.setUri(new URI(entity.getUri()));
            definition.setOrder(entity.getPriority() != null ? entity.getPriority() : 0);

            if (entity.getPredicates() != null && !entity.getPredicates().isBlank()) {
                List<Map<String, Object>> predicates = objectMapper.readValue(entity.getPredicates(), listTypeRef);
                List<PredicateDefinition> predicateDefinitions = new ArrayList<>();
                for (Map<String, Object> predicate : predicates) {
                    String name = (String) predicate.get("name");
                    Map<String, String> args = (Map<String, String>) predicate.get("args");
                    if (name != null) {
                        PredicateDefinition pd = new PredicateDefinition();
                        pd.setName(name);
                        if (args != null) {
                            pd.getArgs().putAll(args);
                        }
                        predicateDefinitions.add(pd);
                    }
                }
                definition.setPredicates(predicateDefinitions);
            }

            if (entity.getFilters() != null && !entity.getFilters().isBlank()) {
                List<Map<String, Object>> filters = objectMapper.readValue(entity.getFilters(), listTypeRef);
                List<FilterDefinition> filterDefinitions = new ArrayList<>();
                for (Map<String, Object> filter : filters) {
                    String name = (String) filter.get("name");
                    Map<String, String> args = (Map<String, String>) filter.get("args");
                    if (name != null) {
                        FilterDefinition fd = new FilterDefinition();
                        fd.setName(name);
                        if (args != null) {
                            fd.getArgs().putAll(args);
                        }
                        filterDefinitions.add(fd);
                    }
                }
                definition.setFilters(filterDefinitions);
            }

            return definition;
        } catch (Exception e) {
            log.error("Failed to convert route {}: {}", entity.getRouteId(), e.getMessage());
            return null;
        }
    }
}
