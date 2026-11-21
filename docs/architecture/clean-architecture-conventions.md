# Clean Architecture conventions and enforcement

Status: Increment 3. Applies to the Java 17 modular monolith. The recurring-payment read workflow is the first completed pilot. The starting checkpoint is `f66fed1d8529eeade5d7fc27e664ef6207c9da58`. The [audit](clean-architecture-audit-2026-11-17.md) remains the migration roadmap; the [baseline](clean-architecture-baseline-2026-11-17.md) records regression results and infrastructure limits.

## Organization and responsibilities

Use `com.fintechapp.fintech_api.<feature>.<layer>` for real feature code. Create packages when a coherent operation needs them, not to populate a template. Existing packages remain legacy until their owning slices migrate. Keep one Maven module and one deployment.

| Layer | Owns | Must keep outside |
|---|---|---|
| `domain` | Business entities/behavior, values, invariants, policies, domain repository contracts, justified factories/facades/events | Frameworks, JPA/Hibernate, Spring, HTTP, provider payloads, concrete storage |
| `application` | Use cases, commands/queries/results, workflows, external capability ports | Controllers, Spring DI/transaction/cache annotations, JPA entities/DAOs, SDKs, HTTP envelopes |
| `adapters` | Repository and provider implementations, presenters, mappers/converters | Fundamental domain rules or provider types leaking through inner contracts |
| `infrastructure` | Controllers/transport DTOs, ORM entities, DAOs, clients, security, scheduling, cache/transaction mechanisms, configuration | Business policies hidden in technical configuration |

`shared.domain` is reserved for proven shared concepts, not a general utility bucket. Global technical composition may live in root `infrastructure`; feature technical code stays with its feature. No new runtime classes or empty production packages are introduced by Increment 1.

## Dependency matrix

Rows depend on columns. These are source/compiled dependencies, not the direction of runtime calls.

| From | Domain | Application | Adapters | Infrastructure | Legacy |
|---|---|---|---|---|---|
| Domain | Own feature and shared domain | No | No | No | No |
| Application | Own feature and shared domain | Own feature; another feature's `application.api` only | No | No | No |
| Adapters | Inner contracts/data | Inner contracts/data; exposed cross-feature API | Own feature | Own DAOs/clients/drivers; shared technical infrastructure | Transitional technical mechanisms only |
| Infrastructure | Inner types as needed | Operation contracts | Own presenters/adapters; composition wires implementations | Own/shared technical mechanisms | Transitional mechanisms as needed |
| Existing legacy | Existing footprint; inward dependencies to new domain permitted | Legacy services may call new inner operations through temporary compatibility facades | No automatic exemption for new violations | Existing forbidden footprint is frozen | See exact inventory and exception rows |

Domain/application external dependencies are intentionally limited to `java.lang`, `java.math`, `java.time`, `java.util`, `java.text`, and primitives. This excludes even JDK transport/database packages such as `java.net.http` and `java.sql`. Additional libraries require an explicit architecture decision and tested policy change, never an exception row disguised as legacy.

Cross-feature implementation access is forbidden: depend on another feature's `application.api` contracts, not its domain internals, adapters or DAOs. A feature may share `shared.domain`. Infrastructure configuration composes concrete objects; new non-configuration code cannot import configuration packages. Configuration classes have no place in use-case signatures.

### Example: repository inversion

```text
recurring.domain.repositories.ExpenseHistory          // inner interface
recurring.application.api.GetRecurringPayments         // input interface/result
recurring.application.GetRecurringPaymentsHandler      // constructor receives ExpenseHistory + Clock
recurring.adapters.persistence.JpaExpenseHistoryAdapter // implements ExpenseHistory
recurring.infrastructure.persistence.*                 // ORM/DAO details, when moved
recurring.infrastructure.web.*                         // HTTP binding
recurring.infrastructure.configuration.*               // concrete wiring/cache/transaction decorators
```

The adapter can initially use the existing Spring Data `repository.TransactionRepository` as its DAO. That adapter-to-DAO dependency is allowed. The use case cannot import that DAO. At runtime the handler calls the injected ExpenseHistory implementation; source code points inward because the interface belongs to the domain. Do not add a second DAO class that only forwards calls without mapping or another purpose.

Domain repository interfaces live in `domain.repositories`, whose types are interfaces. Persistence adapters that access DAOs/JDBC in `adapters.persistence` must implement a domain repository interface or application query/capability interface in `application.ports`. Mappers can share the adapter area without implementing a repository contract when they do not access a DAO. No naming-suffix rule decides whether an adapter implements a contract.

## Modeling, operations and side effects

- Keep business entities separate from JPA rows as each slice migrates. Preserve IDs, timestamps, optimistic versions, protected credentials, atomic spending updates and legacy metadata in explicit mappings. Never deep-copy entire JPA graphs or replace atomic updates with detached generic saves.
- Put meaningful input ports and transport-independent results in `application.api`; external capabilities/query ports belong in `application.ports`. Implementations may be under `application` or an operation subpackage. No interface is required for every private helper. Name operations after behavior; avoid unrelated generic service accumulation.
- Distinguish HTTP DTOs, application data, domain objects, persistence rows and provider payloads only where they vary independently. Map envelopes/status codes at the HTTP boundary. Avoid DTO duplication solely to satisfy layers. Factories and facades must enforce a real invariant or simplify a cohesive domain operation.
- External capability contracts describe required behavior without SDK/JSON/HTTP types. Provider adapters own payload parsing, error translation and concrete clients. Reuse the existing AI seam when its owning slice migrates instead of creating an identical wrapper.
- Supply collaborators through explicit constructors; wire concrete implementations in infrastructure configuration. New architectural packages cannot use field/setter `@Autowired`, `@Value`, `@Inject` or `@Resource`. Domain state mutation is not dependency injection and is not prohibited.
- New domain/application code has no Spring transaction annotations/APIs. Outer decorators/runners retain existing propagation, isolation, lock order and rollback outcomes. A repository contract may describe an atomic operation. Never split cursor advancement from data application or accidentally roll back recovery attempt counters. Existing consent admission keeps its lock-through-provider-call semantics until a separately approved protocol replaces it.
- Cache annotations, Redis keys/TTL/serialization and after-commit callbacks stay outside core. Preserve invalidation and outage behavior. Package changes can affect typed cache serialization; plan compatibility or a deliberate disposable cache namespace version.
- HTTP authentication/security remains infrastructure. Use plain actor/account identity at use-case boundaries; do not pass Spring Security objects. Business ownership/authorization stays explicit and independently tested. Preserve JWT/session version checks, trusted-proxy interpretation, encrypted cache/session generation guards and provider access restrictions.

## Executable backend checks

`ArchitecturePolicy` uses ArchUnit 1.4.1's bytecode model. `ArchitectureTest` runs against **all `target/classes` production output**, including nested classes, never test fixtures or third-party packages as the imported production set. It also checks every main source has an imported class. It does not start Spring, a database, cache or provider connection.

| Check / failure identifier | Enforced behavior |
|---|---|
| Class inventory | Every production class is either in the exact legacy inventory or a recognized feature/layer. New legacy classes, including nested classes, fail. |
| `CORE_DEPENDENCY` | Domain/application follow the matrix and pure-JDK allowance. Dependencies in annotations, inheritance, fields, calls, signatures and generic arguments count; array dependencies are checked by their element type. |
| `FEATURE_ENCAPSULATION` | New features cannot import another feature's private implementation. |
| `COMPOSITION_ROOT` | New non-configuration classes cannot import configuration. |
| `CONTROLLER_PERSISTENCE` | Classes identified by actual Spring controller annotations cannot directly reference persistence packages, old model/repository packages, JDBC or EntityManager. Presenters/application ports remain allowed. |
| `REPOSITORY_CONTRACT` | Domain repository packages contain interfaces, not concrete repository implementations. |
| `REPOSITORY_ADAPTER_CONTRACT` | Concrete persistence adapters using DAO/JDBC dependencies implement an appropriately owned inner contract. |
| `CONSTRUCTOR_INJECTION` | New boundary participants use constructor rather than annotated field/setter injection. |
| `COMPONENT_CYCLE` | No directed cycle between feature domain/application/outer components and legacy package components. |
| Migration registry | Only registered real feature packages count. `complete` requires real domain/application/adapters/infrastructure participants; package-info markers do not count. Empty imports/absent features cannot imply compliance. |

Cycle analysis treats each feature's adapters and infrastructure as one outer component: the intended adapter→DAO collaboration and infrastructure composition must not create an artificial layer-cycle failure. Configuration is excluded as a cycle **source** because it assembles implementations; imports into configuration from new non-configuration code are separately prohibited. This is a component-cycle check, not a ban on every pair of mutually referring entity classes or a proof that runtime DI cannot cycle.

Application entrypoints and controller annotations/signatures are inspected as compiled dependencies. Unused Java imports, reflective string lookups, SQL strings, runtime event delivery and every possible misplacement of technical code cannot be proved by bytecode rules. Keep code review and end-to-end tests; do not treat the package diagram as complete correctness evidence.

## Controlled transition

No blanket package exclusion and no runtime-refreshable frozen store is used. Three versioned files form the transition ledger:

| File under `fintech-api/src/test/resources/architecture/` | Meaning |
|---|---|
| `legacy-classes.tsv` | 239 exact binary class names at the checkpoint, each with a reason and removal increment. A package prefix grants no exemption for additional classes. |
| `legacy-violations.txt` | 2,327 exact existing member-level exceptions. Relative class names use root `com.fintechapp.fintech_api`; source line numbers are normalized. |
| `migration-status.tsv` | Feature/status/owning increment. Currently zero features, explicitly zero migrated compliance. |

Exceptions: 544 model/framework dependencies, 1,753 service/outer dependencies, 15 direct controller/persistence references and 15 legacy injection sites. Their owners/reasons/removal stages are in the class inventory and audit. Known examples are JPA annotations in `model`, Spring/DTO/JDBC/provider dependencies in `service`, PlaidController's persistence-shaped item access and HealthController's repository access. These are tolerated temporarily, not declared clean. Existing technical repositories/configuration remain infrastructure in intent; their class inventory is fixed, while legacy model/service/controller boundary erosion is checked at member level.

The initial snapshot is tied to clean Java 17 **javac** output. Initial IDE-generated class files exposed different lambda/enum implementation details during verification; the uncommitted bootstrap was corrected against a clean build. No source behavior was changed. Use clean commands below rather than treating an IDE compiler's synthetic output as a baseline update request.

New violations fail with `NEW:` details. Fixed entries also fail under `FIXED:` until their exact exception rows are removed, preventing a stale allowance from permitting later reintroduction. There is no generation/update switch, freezer override, CI writeback or committed bootstrap tool. No new-core rule or component cycle can be grandfathered. A new member using an already referenced external class still produces a new member-level exception. Repeated use of an already accepted dependency in the same member is not a distinct architectural edge.

When migrating: add a `partial` feature row with its owning increment; add real code with strict rules; delete fixed exception rows; remove inventory rows only when their legacy classes disappear. Legacy compatibility facades may call the new inner operation without adding exceptions; new core can never call back into legacy. Remove facades in their planned final slice. Mark `complete` only after endpoint/controller wiring, adapter contract tests, behavior parity and code review confirm the whole workflow. The registry shape test alone cannot prove functional parity. An approved future feature with genuinely unnecessary layers should revise the completion criterion explicitly, not add empty layer markers.

This exact read-only ledger was selected instead of ArchUnit's automatically updating FreezeArchRule store to require deliberate pruning and avoid any auto-expansion. The static footprint is relatively large because it retains member/access identities rather than broad class-pair allowances. Do not regenerate the whole ledger to hide a failure. A new legitimate dependency requires fixing its boundary or an explicitly reviewed convention change.

## Running and validating the rules

From `fintech-api`, with JAVA_HOME selecting a full Java 17 JDK:

```sh
./mvnw -Dtest=ArchitectureTest,ArchitecturePolicyTest clean test
```

The same tests run in normal `./mvnw clean verify`. That full command needs the safe disposable PostgreSQL configuration in the baseline; the architecture-only command does not. The installed Java formatter requires its own Java 21+ tool runtime; keep that separate from Maven's application JDK, as documented in the prerequisite baseline.

`ArchitecturePolicyTest` compiles counterexamples under JUnit temporary directories with Java 17, then imports only those isolated fixture classes. Assertions verify the same policy and baseline comparator reject forbidden dependencies. No temporary or intentional violation is written to application source.

Covered counterexamples include Spring and JPA domain annotations; application→concrete storage; domain→application; generic HTTP/provider signature leaks; Spring Data/JPA leakage through repository contracts; direct controller→DAO; unbound persistence adapters; field injection; composition imports; private cross-feature access; cross-feature API cycles; new legacy member leakage; stale exceptions; empty imports; missing/incomplete migrated features; concrete repository implementations and package markers. Positive fixtures verify constructor injection, inner repository implementation→DAO collaboration, and a legacy facade calling inward.

`.github/workflows/architecture.yml` runs the same clean architecture command on Java 17 for backend/workflow pull requests and pushes to dev/main, with read-only repository permissions, no database/provider secrets, and no persisted checkout credentials. The workflow has been added locally; a hosted run is not claimed because this increment is not pushed. Maven remains the single rule execution path; a second pre-commit architecture engine is unnecessary.

## Frontend decision and next pilot

Frontend routes/components, hooks, Redux/RTK state, APIs and native integrations have different responsibilities from Java layers. Existing ESLint supports restricted-import rules, but folder-based restrictions across the current mixed hooks/API/session utilities would require many exceptions and cannot prove transitive purity. Defer frontend restrictions to Increment 12, when a real pure policy/workflow area exists. At that point use existing ESLint `no-restricted-imports`/resolver-aware checks scoped to those actual files, with negative fixtures. Do not create empty frontend domain/application folders, add a second cache, or suppress the 98 existing broader warnings here.

No frontend file/configuration is changed. F10's unused import and global endpoint-contract inventory remain separate characterization/cleanup work; no route is silently repaired. Before Increment 2, freeze recurring output fixtures and its existing HTTP contract, then migrate that read workflow only: plain observations/detector, inner ExpenseHistory contract, GetRecurringPayments input/result, JPA history adapter, presenter and outer cache/Clock wiring. Preserve merchant/series identity, signed-credit/transfer filtering, ordering, limits and 15-minute cache behavior. Healthy Redis must be verified before claiming the cached flow complete; native integrations remain outside this pilot.

## Increment 1 verification

The final Java 17 `clean verify` run passes 820 tests: **809 passed, 0 failed/errors, 11 skipped**. All 783 prior passing tests remain passing; all 26 added architecture tests pass (4 production guards and 22 policy/counterexample tests). The same 11 prior environment/placeholder skips remain. Compilation and executable packaging pass, and inspection confirms the runtime JAR contains no ArchUnit/test fixture classes or ArchUnit JAR. Applicable actual commit hooks and changed-file formatting pass.

Enforcement commit: `b06454261d5e227a8d2dbb055b6adab068035aff`. It is local and unpushed. The following documentation-only commit records these conventions; its hash is reported in the completion response. The only initial untracked material, `sites/`, remains untouched. No `src/main`, frontend source/configuration, schema or existing regression test was changed.

Final logs are `/private/tmp/fundleaf-increment1-final-java17.log` (full suite) and `/private/tmp/fundleaf-architecture-tests.log` (independent clean architecture command). Raw reports are in `fintech-api/target/surefire-reports/`; temporary logs and build output are not durable artifacts. The disposable loopback PostgreSQL database was stopped after validation. Redis/native limits remain unchanged; no hosted workflow run, production access or financial provider operation is claimed.

References: [ArchUnit core and bytecode checks](https://www.archunit.org/userguide/html/000_Index.html), [ArchUnit 1.4.1 release](https://github.com/TNG/ArchUnit/releases/tag/v1.4.1), [official checkout action](https://github.com/actions/checkout), [official Java setup action](https://github.com/actions/setup-java). The project uses the core library with its existing JUnit engine; compatibility is established by the actual Java 17 runs above, not inferred from a package name.

### Files in this increment

| File | Change |
|---|---|
| `fintech-api/pom.xml` | Add pinned, test-only ArchUnit core dependency/version property |
| `fintech-api/src/test/java/com/fintechapp/fintech_api/architecture/ArchitecturePolicy.java` | Shared bytecode dependency/contract/cycle policy |
| `fintech-api/src/test/java/com/fintechapp/fintech_api/architecture/ArchitectureTest.java` | Production import, legacy ledger and migration-declaration guards |
| `fintech-api/src/test/java/com/fintechapp/fintech_api/architecture/ArchitecturePolicyTest.java` | Isolated positive/negative fixtures and guard effectiveness tests |
| `fintech-api/src/test/resources/architecture/legacy-classes.tsv` | Explicit legacy class reasons/removal stages |
| `fintech-api/src/test/resources/architecture/legacy-violations.txt` | Fixed exact member-level transition exceptions |
| `fintech-api/src/test/resources/architecture/migration-status.tsv` | Explicit, currently empty feature migration registry |
| `.github/workflows/architecture.yml` | Java 17 clean architecture-test CI job |
| `docs/architecture/clean-architecture-conventions.md` | New conventions, rules, trade-offs, execution and verification reference |
| `docs/architecture/clean-architecture-audit-2026-11-17.md` | Synchronize Increment 1 status/decisions and proposed next pilot |
| `docs/architecture/clean-architecture-baseline-2026-11-17.md` | Add new results while retaining historical prerequisite measurements |

## Reusing the recurring read pattern

Start by pinning the existing output, ownership, ordering, error behavior, query count and technical boundaries. Place business inputs, values and policy in the feature domain, and use a concrete application operation with constructor-injected collaborators. Introduce an input interface when an actual caller or decorator needs substitutability. The domain owns contracts such as ExpenseHistory that express a business capability. An adapter implements the contract with the existing DAO and maps only fields the policy needs.

Keep actor extraction and HTTP envelopes at the web boundary. Wire the operation, adapter and Clock in infrastructure configuration. When Redis serializes the existing response DTO, keep its class names, collection representation, key and TTL at the cache boundary. Capture the transaction requirements of each operation independently. A recurring read needs no new transaction, while authoritative reporting needs a single stable snapshot. Keep commit-coupled invalidation outside the core and test rollback with real persistence.

A feature is complete at the scoped workflow level when ArchUnit, HTTP parity, pure policy, query/ownership, and relevant integration checks pass. Verify both healthy and degraded behavior for caches. Record remaining exceptions and remove only those resolved by the migration. The recurring detector's cadence policy, 365-day query, Redis decorator and Clock are specific choices. Use only the boundaries a later workflow needs.

## Snapshot-backed report reads

For an authoritative report, define a narrow application-owned query port whose adapter loads ordered, owner-scoped facts. Keep policy in a plain calculator. Apply one transaction at the infrastructure entry point so the entire operation participates, including owner lookup. For legacy consumers already in a transaction, preserve required propagation and accept the already-resolved actor, avoiding a redundant query. Keep legacy DTOs and persistence entities in the compatibility contract at the outer boundary until its callers migrate. Verify participation with a real concurrent writer and a caller with uncommitted data. [Financial report read](financial-report-read.md)
