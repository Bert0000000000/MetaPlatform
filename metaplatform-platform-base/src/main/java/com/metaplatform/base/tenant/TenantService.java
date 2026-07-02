package com.metaplatform.base.tenant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional
public class TenantService {

    private final TenantRepository repository;

    public TenantService(TenantRepository repository) {
        this.repository = repository;
    }

    public Tenant create(String name, String slug) {
        if (repository.existsBySlug(slug)) {
            throw new IllegalArgumentException("Tenant slug already exists: " + slug);
        }
        Tenant tenant = new Tenant(TenantId.newId(), name, slug, true);
        return repository.save(tenant);
    }

    @Transactional(readOnly = true)
    public Tenant findById(TenantId id) {
        return repository.findById(id.value())
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<Tenant> findAll() {
        return repository.findAll();
    }

    public Tenant deactivate(TenantId id) {
        Tenant tenant = findById(id);
        return repository.save(tenant.deactivate());
    }

    public Tenant activate(TenantId id) {
        Tenant tenant = findById(id);
        return repository.save(tenant.activate());
    }
}
