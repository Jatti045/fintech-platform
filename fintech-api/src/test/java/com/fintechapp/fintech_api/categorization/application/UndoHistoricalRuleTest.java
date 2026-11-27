package com.fintechapp.fintech_api.categorization.application;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class UndoHistoricalRuleTest {
  @Test
  void alreadyUndoneSkipsJournalReadAndEffects() {
    var fixture = new Fixture();
    fixture.alreadyUndone = true;
    assertEquals(new UndoHistoricalRule.Result("batch", 0), fixture.execute());
    assertEquals(List.of("prepare", "check"), fixture.calls);
  }

  @Test
  void validatesEveryEntryBeforeRestoringInJournalOrder() {
    var fixture = new Fixture("first", "second");
    assertEquals(new UndoHistoricalRule.Result("batch", 2), fixture.execute());
    assertEquals(
        List.of(
            "prepare",
            "check",
            "entries",
            "validate first",
            "validate second",
            "restore first",
            "restore second",
            "mark",
            "evict"),
        fixture.calls);
  }

  @Test
  void aLaterValidationFailurePreventsAllRestoration() {
    var fixture = new Fixture("first", "second");
    fixture.failureAt = "validate second";
    assertSame(fixture.failure, assertThrows(IllegalStateException.class, fixture::execute));
    assertEquals(
        List.of("prepare", "check", "entries", "validate first", "validate second"), fixture.calls);
  }

  @Test
  void restorationFailurePropagatesBeforeTheJournalIsMarkedOrEvictionRegistered() {
    var fixture = new Fixture("first", "second");
    fixture.failureAt = "restore second";
    assertSame(fixture.failure, assertThrows(IllegalStateException.class, fixture::execute));
    assertEquals(
        List.of(
            "prepare",
            "check",
            "entries",
            "validate first",
            "validate second",
            "restore first",
            "restore second"),
        fixture.calls);
  }

  @Test
  void emptyJournalIsMarkedUndoneWithoutEviction() {
    var fixture = new Fixture();
    assertEquals(new UndoHistoricalRule.Result("batch", 0), fixture.execute());
    assertEquals(List.of("prepare", "check", "entries", "mark"), fixture.calls);
  }

  private static final class Fixture implements UndoHistoricalRule.PreparedUndo {
    private final List<String> calls = new ArrayList<>();
    private final List<UndoHistoricalRule.Entry> entries;
    private final IllegalStateException failure = new IllegalStateException("undo failed");
    private boolean alreadyUndone;
    private String failureAt;

    private Fixture(String... ids) {
      entries = List.of(ids).stream().map(this::entry).toList();
    }

    private UndoHistoricalRule.Result execute() {
      return new UndoHistoricalRule(
              (owner, application) -> {
                assertEquals("owner", owner);
                assertEquals("batch", application);
                calls.add("prepare");
                return this;
              })
          .execute("owner", "batch");
    }

    private UndoHistoricalRule.Entry entry(String id) {
      return new UndoHistoricalRule.Entry() {
        @Override
        public void validate() {
          record("validate " + id);
        }

        @Override
        public void restore() {
          record("restore " + id);
        }
      };
    }

    private void record(String call) {
      calls.add(call);
      if (call.equals(failureAt)) throw failure;
    }

    @Override
    public boolean alreadyUndone() {
      calls.add("check");
      return alreadyUndone;
    }

    @Override
    public List<UndoHistoricalRule.Entry> entries() {
      calls.add("entries");
      return entries;
    }

    @Override
    public void markUndone() {
      calls.add("mark");
    }

    @Override
    public void evictAfterCommit() {
      calls.add("evict");
    }
  }
}
