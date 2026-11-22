package com.fintechapp.fintech_api.categorization.application;

import static org.junit.jupiter.api.Assertions.*;

import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule.Match;
import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule.PreparedApplication;
import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule.Preview;
import com.fintechapp.fintech_api.categorization.application.ApplyHistoricalRule.Result;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ApplyHistoricalRuleTest {
  @Test
  void rejectsStaleTokenBeforeAnyMutationOrJournal() {
    var fixture = new Fixture(List.of(new Match("changed", "target")));
    assertThrows(ApplyHistoricalRule.StalePreview.class, () -> fixture.execute("old"));
    assertEquals(List.of("prepare", "preview"), fixture.calls);
  }

  @Test
  void appliesWinnersInOrderAndSavesJournalBeforeRegisteringEviction() {
    var fixture =
        new Fixture(
            List.of(
                new Match("changed", "target"), new Match("loser", "other"),
                new Match("disabled", "target"), new Match("unchanged", "target")));
    assertEquals(new Result("batch", 1), fixture.execute("current"));
    assertEquals(
        List.of("prepare", "preview", "changed", "disabled", "unchanged", "journal", "evict"),
        fixture.calls);
  }

  @Test
  void persistsEmptyJournalWithoutSchedulingEviction() {
    var fixture = new Fixture(List.of());
    assertEquals(new Result("batch", 0), fixture.execute("current"));
    assertEquals(List.of("prepare", "preview", "journal"), fixture.calls);
  }

  @Test
  void propagatesMutationFailureWithoutSavingJournalOrSchedulingEviction() {
    var fixture = new Fixture(List.of(new Match("failure", "target")));
    assertThrows(IllegalStateException.class, () -> fixture.execute("current"));
    assertEquals(List.of("prepare", "preview", "failure"), fixture.calls);
  }

  private static final class Fixture implements PreparedApplication {
    private final List<String> calls = new ArrayList<>();
    private final List<Match> matches;

    private Fixture(List<Match> matches) {
      this.matches = matches;
    }

    private Result execute(String token) {
      return new ApplyHistoricalRule(
              (owner, rule) -> {
                assertEquals("owner", owner);
                assertEquals("target", rule);
                calls.add("prepare");
                return this;
              })
          .execute("owner", "target", token);
    }

    @Override
    public Preview preview() {
      calls.add("preview");
      return new Preview("current", matches);
    }

    @Override
    public boolean applyTo(String id) {
      calls.add(id);
      if (id.equals("failure")) {
        throw new IllegalStateException("Classification failure");
      }
      return id.equals("changed");
    }

    @Override
    public String saveJournal() {
      calls.add("journal");
      return "batch";
    }

    @Override
    public void evictAfterCommit() {
      calls.add("evict");
    }
  }
}
