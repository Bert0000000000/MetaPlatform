package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.entity.RecentVisitEntity;
import com.metaplatform.dashboard.repository.RecentVisitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RecentVisitService {
    private final RecentVisitRepository repository;
    public List<RecentVisitEntity> list(String userId) { return repository.findByUserIdOrderByVisitedAtDesc(userId, PageRequest.of(0, 20)); }
    public RecentVisitEntity record(String userId, RecentVisitEntity visit) { visit.setId(null); visit.setUserId(userId); visit.setVisitedAt(null); return repository.save(visit); }
}
