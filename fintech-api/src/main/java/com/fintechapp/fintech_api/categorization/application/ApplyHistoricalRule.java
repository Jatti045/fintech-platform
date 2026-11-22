package com.fintechapp.fintech_api.categorization.application;

import java.util.List;
import java.util.Objects;

public final class ApplyHistoricalRule {
  private final Store store;

  public ApplyHistoricalRule(Store store) {
    this.store = store;
  }

  public Result execute(String ownerId, String ruleId, String token) {
    PreparedApplication application = store.prepare(ownerId, ruleId);
    Preview preview = application.preview();
    if (!Objects.equals(token, preview.token())) {
      throw new StalePreview();
    }
    int changed = 0;
    for (Match match : preview.matches()) {
      if (ruleId.equals(match.winnerId()) && application.applyTo(match.transactionId())) {
        changed++;
      }
    }
    String applicationId = application.saveJournal();
    if (changed > 0) {
      application.evictAfterCommit();
    }
    return new Result(applicationId, changed);
  }

  /** Prepares the operation under the owner's write lock in the caller's transaction. */
  public interface Store {
    PreparedApplication prepare(String ownerId, String ruleId);
  }

  public interface PreparedApplication {
    Preview preview();

    /** Skips disabled transactions and appends a journal entry only for a changed state. */
    boolean applyTo(String transactionId);

    String saveJournal();

    void evictAfterCommit();
  }

  public record Match(String transactionId, String winnerId) {}

  public record Preview(String token, List<Match> matches) {}

  public record Result(String applicationId, int changed) {}

  public static final class StalePreview extends RuntimeException {}
}
