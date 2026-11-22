package com.fintechapp.fintech_api.architecture;

import static org.junit.jupiter.api.Assertions.*;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Compile isolated counterexamples outside main output; test the very same production policy. */
class ArchitecturePolicyTest {
  private static final String ROOT = "architecturefixtures";
  private static final ArchitecturePolicy POLICY = new ArchitecturePolicy(ROOT);
  @TempDir static Path temporary;
  private static JavaClasses fixtures;

  @BeforeAll
  static void compileFixtures() throws IOException {
    Map<String, String> sources =
        Map.ofEntries(
            Map.entry(
                "service.CompatibilityFacade",
                "public class CompatibilityFacade {"
                    + " architecturefixtures.good.application.api.ReadExpenses operation; }"),
            Map.entry(
                "bad.domain.repositories.ConcreteRepository", "public class ConcreteRepository {}"),
            Map.entry(
                "good.domain.Expense", "public record Expense(java.math.BigDecimal amount) {}"),
            Map.entry(
                "good.domain.repositories.History",
                "public interface History {"
                    + " java.util.List<architecturefixtures.good.domain.Expense> all(); }"),
            Map.entry(
                "good.application.api.ReadExpenses",
                "public interface ReadExpenses {"
                    + " java.util.List<architecturefixtures.good.domain.Expense> read(); }"),
            Map.entry(
                "good.application.Handler",
                "public class Handler implements"
                    + " architecturefixtures.good.application.api.ReadExpenses { private final"
                    + " architecturefixtures.good.domain.repositories.History history; public"
                    + " Handler(architecturefixtures.good.domain.repositories.History history)"
                    + " {this.history=history;} public"
                    + " java.util.List<architecturefixtures.good.domain.Expense> read(){return"
                    + " history.all();} }"),
            Map.entry(
                "good.infrastructure.persistence.Dao", "public class Dao { public void load(){} }"),
            Map.entry(
                "good.adapters.persistence.HistoryAdapter",
                "public class HistoryAdapter implements"
                    + " architecturefixtures.good.domain.repositories.History { private final"
                    + " architecturefixtures.good.infrastructure.persistence.Dao dao; public"
                    + " HistoryAdapter(architecturefixtures.good.infrastructure.persistence.Dao"
                    + " dao){this.dao=dao;} public"
                    + " java.util.List<architecturefixtures.good.domain.Expense>"
                    + " all(){dao.load();return java.util.List.of();} }"),
            Map.entry(
                "good.infrastructure.web.Endpoint",
                "@org.springframework.web.bind.annotation.RestController public class Endpoint {"
                    + " private final architecturefixtures.good.application.api.ReadExpenses read;"
                    + " public Endpoint(architecturefixtures.good.application.api.ReadExpenses"
                    + " read){this.read=read;} public Object get(){return read.read();} }"),
            Map.entry(
                "bad.domain.SpringPolicy",
                "@org.springframework.stereotype.Service public class SpringPolicy {}"),
            Map.entry(
                "bad.domain.PersistenceEntity",
                "@jakarta.persistence.Entity public class PersistenceEntity {"
                    + " @jakarta.persistence.Id public String id; }"),
            Map.entry("bad.infrastructure.persistence.Store", "public class Store {}"),
            Map.entry(
                "bad.application.ConcreteUseCase",
                "public class ConcreteUseCase {"
                    + " architecturefixtures.bad.infrastructure.persistence.Store store; }"),
            Map.entry(
                "bad.application.api.HttpResult",
                "public interface HttpResult {"
                    + " java.util.List<org.springframework.http.ResponseEntity<String>> execute();"
                    + " }"),
            Map.entry(
                "bad.application.api.ProviderPayload",
                "public interface ProviderPayload { tools.jackson.databind.JsonNode execute(); }"),
            Map.entry(
                "bad.domain.repositories.JpaContract",
                "public interface JpaContract extends"
                    + " org.springframework.data.repository.Repository<com.fintechapp.fintech_api.model.User,String>"
                    + " {}"),
            Map.entry(
                "bad.domain.Upward",
                "public class Upward { architecturefixtures.bad.application.ConcreteUseCase"
                    + " useCase; }"),
            Map.entry(
                "bad.infrastructure.web.DirectDaoEndpoint",
                "@org.springframework.web.bind.annotation.RestController public class"
                    + " DirectDaoEndpoint {"
                    + " architecturefixtures.bad.infrastructure.persistence.Store store; }"),
            Map.entry(
                "bad.adapters.persistence.UnboundAdapter",
                "public class UnboundAdapter {"
                    + " architecturefixtures.bad.infrastructure.persistence.Store store; }"),
            Map.entry(
                "bad.application.Injected",
                "public class Injected { @org.springframework.beans.factory.annotation.Autowired"
                    + " architecturefixtures.good.domain.repositories.History history; }"),
            Map.entry("bad.infrastructure.configuration.Wiring", "public class Wiring {}"),
            Map.entry(
                "bad.adapters.ConfigurationConsumer",
                "public class ConfigurationConsumer {"
                    + " architecturefixtures.bad.infrastructure.configuration.Wiring wiring; }"),
            Map.entry(
                "bad.adapters.PrivateFeatureConsumer",
                "public class PrivateFeatureConsumer {"
                    + " architecturefixtures.good.infrastructure.persistence.Dao dao; }"),
            Map.entry(
                "alpha.application.api.One",
                "public class One { architecturefixtures.beta.application.api.Two other; }"),
            Map.entry(
                "beta.application.api.Two",
                "public class Two { architecturefixtures.alpha.application.api.One other; }"),
            Map.entry(
                "service.Legacy",
                "public class Legacy { org.springframework.web.client.RestClient original; public"
                    + " org.springframework.web.client.RestClient newLeak(){return original;} }"));
    List<String> args =
        new ArrayList<>(
            List.of(
                "--release",
                "17",
                "-classpath",
                System.getProperty("java.class.path"),
                "-d",
                temporary.toString()));
    for (var entry : sources.entrySet()) {
      String name = ROOT + "." + entry.getKey();
      Path file = temporary.resolve("sources/" + name.replace('.', '/') + ".java");
      Files.createDirectories(file.getParent());
      Files.writeString(
          file, "package " + name.substring(0, name.lastIndexOf('.')) + ";\n" + entry.getValue());
      args.add(file.toString());
    }
    Path marker = temporary.resolve("sources/architecturefixtures/empty/domain/package-info.java");
    Files.createDirectories(marker.getParent());
    Files.writeString(marker, "@Deprecated package architecturefixtures.empty.domain;");
    args.add(marker.toString());
    var compiler = ToolProvider.getSystemJavaCompiler();
    assertNotNull(compiler, "Rule probes require a JDK, not a JRE");
    assertEquals(
        0,
        compiler.run(null, null, null, args.toArray(String[]::new)),
        "Architecture probe compilation failed");
    fixtures = new ClassFileImporter().importPath(temporary.resolve(ROOT));
  }

  private Set<String> violations(String... names) {
    Set<String> selected = Set.of(names);
    var selectedClasses =
        fixtures.that(
            com.tngtech.archunit.base.DescribedPredicate.describe(
                "selected fixtures",
                t -> selected.contains(t.getName().substring(ROOT.length() + 1))));
    return POLICY.violations(selectedClasses);
  }

  private void rejects(String rule, String... names) {
    Set<String> actual = violations(names);
    AssertionError failure =
        assertThrows(
            AssertionError.class, () -> assertTrue(actual.isEmpty(), String.join("\n", actual)));
    assertTrue(failure.getMessage().contains(rule), failure.getMessage());
  }

  @Test
  void domainCannotImportSpringAnnotations() {
    rejects("CORE_DEPENDENCY", "bad.domain.SpringPolicy");
  }

  @Test
  void domainCannotContainJpaAnnotations() {
    rejects("CORE_DEPENDENCY", "bad.domain.PersistenceEntity");
  }

  @Test
  void applicationCannotDependOnConcretePersistence() {
    rejects("CORE_DEPENDENCY", "bad.application.ConcreteUseCase");
  }

  @Test
  void genericUseCaseSignaturesCannotLeakHttpTypes() {
    rejects("CORE_DEPENDENCY", "bad.application.api.HttpResult");
  }

  @Test
  void useCaseSignaturesCannotLeakProviderPayloads() {
    rejects("CORE_DEPENDENCY", "bad.application.api.ProviderPayload");
  }

  @Test
  void repositoryContractsCannotExposeJpaOrPersistenceModels() {
    rejects("CORE_DEPENDENCY", "bad.domain.repositories.JpaContract");
  }

  @Test
  void domainCannotDependUpwardOnApplication() {
    rejects("CORE_DEPENDENCY", "bad.domain.Upward");
  }

  @Test
  void controllersCannotAccessDaosDirectly() {
    rejects("CONTROLLER_PERSISTENCE", "bad.infrastructure.web.DirectDaoEndpoint");
  }

  @Test
  void persistenceAdaptersMustImplementInnerContracts() {
    rejects("REPOSITORY_ADAPTER_CONTRACT", "bad.adapters.persistence.UnboundAdapter");
  }

  @Test
  void dependenciesCannotUseFieldInjection() {
    rejects("CONSTRUCTOR_INJECTION", "bad.application.Injected");
  }

  @Test
  void adaptersCannotImportCompositionRoots() {
    rejects("COMPOSITION_ROOT", "bad.adapters.ConfigurationConsumer");
  }

  @Test
  void featuresCannotImportAnotherFeaturesPrivateImplementation() {
    rejects("FEATURE_ENCAPSULATION", "bad.adapters.PrivateFeatureConsumer");
  }

  @Test
  void applicationApiCyclesAreDetected() {
    rejects("COMPONENT_CYCLE", "alpha.application.api.One", "beta.application.api.Two");
  }

  @Test
  void validConstructorInjectionAndRepositoryAdapterToDaoAreAllowed() {
    var good =
        fixtures.that(
            com.tngtech.archunit.base.DescribedPredicate.describe(
                "valid feature", t -> t.getName().startsWith(ROOT + ".good.")));
    assertFalse(good.isEmpty(), "The positive architecture fixture must contain real bytecode");
    assertTrue(POLICY.violations(good).isEmpty(), POLICY.violations(good).toString());
  }

  @Test
  void addingAnotherMemberOnAnExistingLegacyDependencyIsStillDetected() {
    Set<String> actual = violations("service.Legacy");
    Set<String> old =
        actual.stream()
            .filter(v -> !v.contains("newLeak"))
            .collect(java.util.stream.Collectors.toSet());
    assertFalse(old.isEmpty(), "Probe must include an accepted old dependency");
    assertTrue(actual.stream().anyMatch(v -> v.contains("newLeak")), actual.toString());
    assertThrows(
        AssertionError.class, () -> ArchitectureTest.requireAcceptedViolations(actual, old));
  }

  @Test
  void fixedLegacyExceptionsMustBeRemovedBeforeTheyCanBeReintroduced() {
    assertThrows(
        AssertionError.class,
        () ->
            ArchitectureTest.requireAcceptedViolations(
                Set.of(), Set.of("LEGACY_INJECTION | fixed member")));
  }

  @Test
  void emptyProductionImportsAreNotCompliance() {
    assertThrows(
        AssertionError.class,
        () ->
            ArchitectureTest.requireProductionClasses(
                new ClassFileImporter().importPath(temporary.resolve("sources"))));
  }

  @Test
  void nonexistentMigratedFeatureCannotBeDeclaredComplete() {
    assertThrows(
        AssertionError.class,
        () -> ArchitectureTest.requireFeatureParticipants(Map.of("missing", "complete"), Map.of()));
  }

  @Test
  void partialFeatureCannotBeDeclaredCompleteWithMissingLayers() {
    assertThrows(
        AssertionError.class,
        () ->
            ArchitectureTest.requireFeatureParticipants(
                Map.of("good", "complete"), Map.of("good", Set.of("domain"))));
  }

  @Test
  void repositoryContractPackagesCannotContainConcreteImplementations() {
    rejects("REPOSITORY_CONTRACT", "bad.domain.repositories.ConcreteRepository");
  }

  @Test
  void packageMarkersDoNotCountAsMigratedFeatureParticipants() {
    var markers =
        fixtures.that(
            com.tngtech.archunit.base.DescribedPredicate.describe(
                "package marker", t -> t.getName().contains(".empty.")));
    assertFalse(markers.isEmpty(), "Probe must import a real package-info class");
    assertTrue(ArchitectureTest.featureParticipants(markers, POLICY).isEmpty());
    assertThrows(
        AssertionError.class,
        () ->
            ArchitectureTest.requireFeatureParticipants(
                Map.of("empty", "complete"),
                ArchitectureTest.featureParticipants(markers, POLICY)));
  }

  @Test
  void legacyCompatibilityFacadeMayDependInwardWithoutNewExceptions() {
    assertTrue(violations("service.CompatibilityFacade").isEmpty());
  }
}
