package com.metaplatform.ont.security;

/**
 * Backward-compat shim. Real class is {@link ContextSnapshotSigner}.
 */
public class SnapshotSigner extends ContextSnapshotSigner {
    public SnapshotSigner(String secret) {
        super(secret);
    }
}
