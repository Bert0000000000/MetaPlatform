package com.metaplatform.agent.migrations;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * §17.10 rollback precondition: every TECH-* module's Flyway directory must be
 * clean (no .bak files), uniquely versioned (no duplicate V__ prefix), and
 * monotonically increasing within each module. Duplicate V1 silently skips the
 * second file at runtime, leaving the database with missing tables
 * (action_definitions, executions, obs_run_event). This test catches that class
 * of regression across the whole monorepo.
 */
@DisplayName("§17.10 Migration directory rollback audit")
class MigrationDirectoryAuditTest {

    private static final Pattern VERSION_PREFIX = Pattern.compile("^V([0-9]+)__");
    private static final Path REPO_ROOT = Paths.get(System.getProperty("user.dir")).getParent();

    private static List<Path> migrationDirs() throws IOException {
        java.util.List<Path> out = new ArrayList<>();
        try (Stream<Path> stream = Files.list(REPO_ROOT)) {
            for (Path p : stream.toList()) {
                if (!Files.isDirectory(p)) continue;
                String name = p.getFileName().toString();
                if (name.startsWith("TECH-") || name.startsWith("APP-")) {
                    Path mig = p.resolve("src/main/resources/db/migration");
                    if (Files.isDirectory(mig)) out.add(mig);
                }
            }
        }
        return out;
    }

    private static List<Path> filesIn(Path dir) throws IOException {
        List<Path> files = new ArrayList<>();
        try (Stream<Path> s = Files.walk(dir)) {
            s.filter(Files::isRegularFile).forEach(files::add);
        }
        return files;
    }

    private static int version(Path file) {
        String fname = file.getFileName().toString();
        Matcher m = VERSION_PREFIX.matcher(fname);
        if (!m.find()) return -1;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    @Test
    @DisplayName("no .bak files anywhere under any TECH-*/APP-* Flyway directory")
    void noBakFilesAnywhere() throws IOException {
        List<Path> offenders = new ArrayList<>();
        for (Path mig : migrationDirs()) {
            for (Path f : filesIn(mig)) {
                String n = f.getFileName().toString();
                if (n.endsWith(".bak") || n.endsWith("~") || n.contains(".bak.")) offenders.add(f);
            }
        }
        assertTrue(offenders.isEmpty(),
                "Found stale migration files (refuse to pass): " + offenders);
    }

    @Test
    @DisplayName("no duplicate V__ versions per module (Flyway silently skips the second)")
    void noDuplicateVersions() throws IOException {
        Map<String, List<Path>> dupes = new HashMap<>();
        for (Path mig : migrationDirs()) {
            Map<Integer, List<Path>> perMod = new HashMap<>();
            for (Path f : filesIn(mig)) {
                int v = version(f);
                if (v <= 0) continue;
                perMod.computeIfAbsent(v, k -> new ArrayList<>()).add(f);
            }
            for (Map.Entry<Integer, List<Path>> e : perMod.entrySet()) {
                if (e.getValue().size() > 1) {
                    dupes.put(mig + " :: V" + e.getKey(), e.getValue());
                }
            }
        }
        assertTrue(dupes.isEmpty(),
                "Duplicate Flyway versions found (would cause silent table-not-created bugs): " + dupes);
    }

    @Test
    @DisplayName("versions are monotonically strictly-increasing within each module")
    void versionsMonotonic() throws IOException {
        Map<String, String> bad = new HashMap<>();
        for (Path mig : migrationDirs()) {
            int last = 0;
            String lastName = null;
            List<Path> sorted = new ArrayList<>(filesIn(mig));
            sorted.sort((a, b) -> Integer.compare(version(a), version(b)));
            for (Path f : sorted) {
                int v = version(f);
                if (v <= 0) continue;
                if (v <= last) {
                    bad.put(mig.toString(), lastName + " then " + f.getFileName());
                    break;
                }
                last = v;
                lastName = f.getFileName().toString();
            }
        }
        assertTrue(bad.isEmpty(), "Non-monotonic migration order detected: " + bad);
    }

    @Test
    @DisplayName("TECH-ACTION and TECH-OBS no longer carry the v1.58-era duplicate V1 entries")
    void specificDuplicatesFixed() throws IOException {
        // Real duplicates that were blocking §17.10 rollback - renamed in v1.59.
        for (Path mig : migrationDirs()) {
            String module = mig.getParent().getParent().getFileName().toString();
            for (Path f : filesIn(mig)) {
                String fname = f.getFileName().toString();
                if (module.equals("TECH-ACTION") && fname.equals("V1__init_action_schema.sql")) {
                    fail("TECH-ACTION still has the old duplicate V1__init_action_schema.sql: " + f);
                }
                if (module.equals("TECH-OBS") && fname.equals("V1__init_obs_run_event.sql")) {
                    fail("TECH-OBS still has the old duplicate V1__init_obs_run_event.sql: " + f);
                }
            }
        }
    }
}
