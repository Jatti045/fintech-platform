package com.fintechapp.fintech_api.architecture;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMember;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/** Bytecode policy shared by production checks and deliberately invalid, isolated fixtures. */
final class ArchitecturePolicy {
  static final String ROOT = "com.fintechapp.fintech_api";
  static final Set<String> LEGACY =
      Set.of(
          "ai",
          "config",
          "controller",
          "dto",
          "exception",
          "model",
          "repository",
          "security",
          "service");
  private final String root;

  ArchitecturePolicy(String root) {
    this.root = root;
  }

  record Location(String feature, String layer) {}

  Location location(JavaClass type) {
    String name = type.getPackageName();
    if (!name.startsWith(root + ".")) return null;
    String[] parts = name.substring(root.length() + 1).split("\\.");
    if (parts[0].equals("infrastructure")) return new Location("platform", "infrastructure");
    if (parts.length > 1
        && Set.of("domain", "application", "adapters", "infrastructure").contains(parts[1])) {
      return new Location(parts[0], parts[1]);
    }
    return null;
  }

  private boolean plainJdk(String name) {
    return List.of("java.lang.", "java.math.", "java.time.", "java.util.", "java.text.").stream()
            .anyMatch(name::startsWith)
        || Set.of("void", "boolean", "byte", "char", "short", "int", "long", "float", "double")
            .contains(name);
  }

  private boolean in(String name, String suffix) {
    return name.startsWith(root + "." + suffix + ".");
  }

  private boolean configuration(JavaClass type) {
    return type.getPackageName().contains(".infrastructure.configuration")
        || in(type.getName(), "config");
  }

  private boolean permittedCoreDependency(Location source, JavaClass target) {
    if (plainJdk(target.getName())) return true;
    Location to = location(target);
    if (to == null) return false;
    if (source.layer().equals("domain")) {
      return to.layer().equals("domain")
          && (to.feature().equals(source.feature()) || to.feature().equals("shared"));
    }
    if (to.feature().equals("shared") && to.layer().equals("domain")) return true;
    if (to.feature().equals(source.feature()))
      return Set.of("domain", "application").contains(to.layer());
    return to.layer().equals("application")
        && (target.getPackageName().equals(root + "." + to.feature() + ".application.api")
            || target.getPackageName().startsWith(root + "." + to.feature() + ".application.api."));
  }

  private boolean inner(JavaClass type, Set<String> layers) {
    Location at = location(type);
    return at != null && layers.contains(at.layer());
  }

  Set<String> violations(JavaClasses classes) {
    Set<String> result = new TreeSet<>();
    for (JavaClass type : classes) {
      Location from = location(type);
      boolean legacyModel = in(type.getName(), "model");
      boolean legacyService = in(type.getName(), "service");
      for (Dependency edge : type.getDirectDependenciesFromSelf()) {
        JavaClass target = edge.getTargetClass();
        if (target.isArray()) target = target.getBaseComponentType();
        String rule = null;
        if (from != null
            && Set.of("domain", "application").contains(from.layer())
            && !permittedCoreDependency(from, target)) {
          rule = "CORE_DEPENDENCY";
        } else if (legacyModel
            && !plainJdk(target.getName())
            && !in(target.getName(), "model")
            && !inner(target, Set.of("domain"))) {
          rule = "LEGACY_MODEL_DEPENDENCY";
        } else if (legacyService
            && !plainJdk(target.getName())
            && !in(target.getName(), "model")
            && !in(target.getName(), "service")
            && !inner(target, Set.of("domain", "application"))
            && !Set.of(root + ".ai.AiCompletionClient", root + ".ai.AiClientException")
                .contains(target.getName())) {
          rule = "LEGACY_SERVICE_DEPENDENCY";
        }
        if (rule != null) add(result, rule, edge.getDescription());
        if (from != null && !configuration(type) && configuration(target))
          add(result, "COMPOSITION_ROOT", edge.getDescription());
        if (from != null && !from.feature().equals("platform")) {
          Location to = location(target);
          if (to != null
              && !from.feature().equals(to.feature())
              && !to.feature().equals("shared")
              && !to.feature().equals("platform")
              && !(to.layer().equals("application")
                  && (target.getPackageName().equals(root + "." + to.feature() + ".application.api")
                      || target
                          .getPackageName()
                          .startsWith(root + "." + to.feature() + ".application.api.")))) {
            add(result, "FEATURE_ENCAPSULATION", edge.getDescription());
          }
        }
        boolean controller =
            type.isAnnotatedWith("org.springframework.web.bind.annotation.RestController")
                || type.isAnnotatedWith("org.springframework.stereotype.Controller");
        if (controller
            && (in(target.getName(), "model")
                || in(target.getName(), "repository")
                || target.getPackageName().contains(".infrastructure.persistence")
                || target.getPackageName().contains(".adapters.persistence")
                || target.getName().startsWith("org.springframework.jdbc.")
                || target.getName().equals("jakarta.persistence.EntityManager"))) {
          add(
              result,
              from == null ? "LEGACY_CONTROLLER_PERSISTENCE" : "CONTROLLER_PERSISTENCE",
              edge.getDescription());
        }
      }
      if (from != null && type.getPackageName().contains(".domain.repositories")) {
        if (!type.isInterface())
          add(
              result,
              "REPOSITORY_CONTRACT",
              type.getName() + " must be an interface in domain.repositories");
      }
      if (from != null
          && from.layer().equals("adapters")
          && type.getPackageName().contains(".adapters.persistence")
          && !type.isInterface()
          && !type.getModifiers()
              .contains(com.tngtech.archunit.core.domain.JavaModifier.ABSTRACT)) {
        boolean accessesDao =
            type.getDirectDependenciesFromSelf().stream()
                .anyMatch(d ->
                    in(d.getTargetClass().getName(), "repository")
                        || d.getTargetClass()
                            .getPackageName()
                            .contains(".infrastructure.persistence")
                        || d.getTargetClass().getName().startsWith("org.springframework.jdbc."));
        boolean innerContract =
            type.getAllRawInterfaces().stream()
                .anyMatch(i -> {
                  Location at = location(i);
                  return at != null
                      && (i.getPackageName().contains(".domain.repositories")
                          || i.getPackageName().contains(".application.ports"));
                });
        if (accessesDao && !innerContract)
          add(
              result,
              "REPOSITORY_ADAPTER_CONTRACT",
              type.getName() + " accesses a DAO but implements no inner-owned contract");
      }
      if (from != null || legacyService || in(type.getName(), "controller")) {
        for (JavaMember member : type.getMembers()) {
          if (!member.getOwner().equals(type)
              || member instanceof com.tngtech.archunit.core.domain.JavaConstructor) continue;
          for (var annotation : member.getAnnotations()) {
            if (Set.of(
                    "org.springframework.beans.factory.annotation.Autowired",
                    "org.springframework.beans.factory.annotation.Value",
                    "jakarta.inject.Inject",
                    "javax.inject.Inject",
                    "jakarta.annotation.Resource")
                .contains(annotation.getRawType().getName())) {
              add(
                  result,
                  from == null ? "LEGACY_INJECTION" : "CONSTRUCTOR_INJECTION",
                  member.getFullName()
                      + " uses "
                      + annotation.getRawType().getName()
                      + "; inject through a constructor");
            }
          }
        }
      }
    }
    result.addAll(cycles(classes));
    return result;
  }

  private void add(Set<String> result, String rule, String detail) {
    // Keep member/signature/access identity, but not volatile source line numbers.
    result.add(
        rule
            + " | "
            + detail.replaceAll("\\([^()]*\\.java:\\d+\\)", "(source)").replace(root + ".", ""));
  }

  private String component(JavaClass type) {
    if (type.isArray()) type = type.getBaseComponentType();
    Location at = location(type);
    if (at != null)
      return at.feature()
          + "."
          + (Set.of("adapters", "infrastructure").contains(at.layer()) ? "outer" : at.layer());
    if (!type.getName().startsWith(root + ".")) return null;
    return "legacy." + type.getName().substring(root.length() + 1).split("\\.")[0];
  }

  private Set<String> cycles(JavaClasses classes) {
    Map<String, Set<String>> graph = new HashMap<>();
    for (JavaClass type : classes) {
      if (configuration(type))
        continue; // Composition points outward by construction; nobody new may import it.
      String from = component(type);
      if (from == null) continue;
      graph.computeIfAbsent(from, k -> new TreeSet<>());
      for (Dependency edge : type.getDirectDependenciesFromSelf()) {
        String to = component(edge.getTargetClass());
        if (to != null && !from.equals(to)) graph.get(from).add(to);
      }
    }
    Set<String> result = new TreeSet<>();
    for (String start : graph.keySet()) findCycles(start, start, graph, new ArrayList<>(), result);
    return result;
  }

  private void findCycles(
      String start,
      String node,
      Map<String, Set<String>> graph,
      List<String> path,
      Set<String> result) {
    if (path.contains(node)) {
      if (node.equals(start)) {
        List<String> ordered = new ArrayList<>(path);
        ordered.add(start);
        result.add("COMPONENT_CYCLE | " + String.join(" -> ", ordered));
      }
      return;
    }
    path.add(node);
    for (String next : graph.getOrDefault(node, Set.of())) {
      // Canonical starting point avoids rotated copies of the same directed cycle.
      if (next.compareTo(start) >= 0) findCycles(start, next, graph, path, result);
    }
    path.remove(path.size() - 1);
  }
}
