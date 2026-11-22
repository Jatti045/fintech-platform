package com.fintechapp.fintech_api.architecture;

import static org.junit.jupiter.api.Assertions.*;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class ArchitectureTest {
  private static final Path RESOURCES = Path.of("src/test/resources/architecture");
  private static final ArchitecturePolicy POLICY = new ArchitecturePolicy(ArchitecturePolicy.ROOT);
  // Import production output only: not test fixtures, third-party packages or a Spring context.
  private static final JavaClasses CLASSES =
      new ClassFileImporter().importPath(Path.of("target/classes"));

  static Set<String> lines(String file) throws IOException {
    return Files.readAllLines(RESOURCES.resolve(file)).stream()
        .map(String::strip)
        .filter(l -> !l.isEmpty() && !l.startsWith("#"))
        .collect(Collectors.toCollection(TreeSet::new));
  }

  @Test
  void everyProductionClassHasAnExplicitArchitecturalHome() throws IOException {
    Set<String> legacy =
        lines("legacy-classes.tsv").stream()
            .map(l -> l.split("\\t", -1)[0])
            .collect(Collectors.toSet());
    Set<String> actualLegacy = new TreeSet<>();
    for (JavaClass type : CLASSES) {
      assertTrue(
          type.getName().startsWith(ArchitecturePolicy.ROOT + "."),
          "Unexpected production class " + type.getName());
      if (POLICY.location(type) == null) actualLegacy.add(type.getName());
    }
    assertEquals(
        legacy,
        actualLegacy,
        "Legacy inventory changed. New classes belong in a registered feature/layer; remove"
            + " obsolete inventory rows when migrating. Do not expand this inventory to hide new"
            + " code.");
    for (String row : lines("legacy-classes.tsv")) {
      String[] columns = row.split("\\t", -1);
      assertEquals(
          3, columns.length, "Each legacy class requires a reason and removal increment: " + row);
      assertFalse(columns[1].isBlank());
      assertTrue(columns[2].matches("Increment [0-9]+(?:-[0-9]+)?"), row);
    }
  }

  @Test
  void dependencyViolationsCannotGrowOrBeReintroducedAfterRemoval() throws IOException {
    Set<String> accepted = lines("legacy-violations.txt");
    assertTrue(
        accepted.stream().allMatch(v -> v.startsWith("LEGACY_")),
        "Only legacy member dependencies/injection may be grandfathered. New architecture rules and"
            + " cycles cannot be baselined.");
    requireAcceptedViolations(POLICY.violations(CLASSES), accepted);
  }

  static void requireAcceptedViolations(Set<String> actual, Set<String> accepted) {
    Set<String> added = new TreeSet<>(actual);
    added.removeAll(accepted);
    Set<String> removed = new TreeSet<>(accepted);
    removed.removeAll(actual);
    assertTrue(
        added.isEmpty() && removed.isEmpty(),
        () ->
            "Architecture violations changed. Fix new edges; delete fixed exceptions instead of"
                + " regenerating the baseline.\n"
                + "NEW:\n"
                + String.join("\n", added)
                + "\nFIXED (remove these baseline rows):\n"
                + String.join("\n", removed));
  }

  @Test
  void migrationDeclarationsCannotClaimEmptyOrIncompleteFeatures() throws IOException {
    Map<String, String> declared = new TreeMap<>();
    for (String row : lines("migration-status.tsv")) {
      String[] parts = row.split("\\t", -1);
      assertEquals(3, parts.length, "Feature, status and migration increment required: " + row);
      assertTrue(
          parts[0].matches("[a-z][a-z0-9]*") && !ArchitecturePolicy.LEGACY.contains(parts[0]), row);
      assertTrue(Set.of("partial", "complete").contains(parts[1]), row);
      assertTrue(parts[2].matches("Increment [0-9]+"), row);
      assertNull(declared.put(parts[0], parts[1]), "Duplicate feature declaration " + parts[0]);
    }
    Map<String, Set<String>> actual = featureParticipants(CLASSES, POLICY);
    requireFeatureParticipants(declared, actual);
    System.out.printf(
        "Architecture inventory: %d production classes; %d registered features, %d complete. No"
            + " feature migration is claimed by an empty registry.%n",
        CLASSES.size(),
        declared.size(),
        declared.values().stream().filter("complete"::equals).count());
  }

  static Map<String, Set<String>> featureParticipants(
      JavaClasses classes, ArchitecturePolicy policy) {
    Map<String, Set<String>> actual = new TreeMap<>();
    for (JavaClass type : classes) {
      if (type.getName().endsWith(".package-info")) continue;
      var at = policy.location(type);
      if (at != null && !at.feature().equals("platform"))
        actual.computeIfAbsent(at.feature(), k -> new TreeSet<>()).add(at.layer());
    }
    return actual;
  }

  static void requireFeatureParticipants(
      Map<String, String> declared, Map<String, Set<String>> actual) {
    assertEquals(
        declared.keySet(),
        actual.keySet(),
        "Register real feature packages explicitly; a declared feature must contain production"
            + " classes, not package markers.");
    declared.forEach((feature, status) -> {
      if (status.equals("complete"))
        assertEquals(
            Set.of("domain", "application", "adapters", "infrastructure"),
            actual.get(feature),
            "A completed end-to-end feature requires real boundary participants; functional parity"
                + " must also be reviewed.");
    });
  }

  static void requireProductionClasses(JavaClasses classes) {
    assertTrue(
        classes.size() > 0,
        "Architecture check imported no production output. Compile main classes first.");
  }

  @Test
  void productionImportIsNonemptyAndIncludesEveryMainSource() throws IOException {
    requireProductionClasses(CLASSES);
    try (var files = Files.walk(Path.of("src/main/java"))) {
      for (Path source :
          files
              .filter(p ->
                  p.toString().endsWith(".java")
                      && !p.getFileName().toString().equals("package-info.java"))
              .toList()) {
        String text = Files.readString(source);
        var matcher = java.util.regex.Pattern.compile("package\\s+([\\w.]+)\\s*;").matcher(text);
        assertTrue(matcher.find(), "Missing package in " + source);
        String name = matcher.group(1) + "." + source.getFileName().toString().replace(".java", "");
        assertTrue(CLASSES.contain(name), "Production class omitted by importer: " + name);
      }
    }
  }
}
