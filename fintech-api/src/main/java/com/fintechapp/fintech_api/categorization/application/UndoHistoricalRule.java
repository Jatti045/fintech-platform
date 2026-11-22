package com.fintechapp.fintech_api.categorization.application;

import java.util.List;

public final class UndoHistoricalRule {
  private final Store store;

  public UndoHistoricalRule(Store store) {
    this.store = store;
  }

  public Result execute(String ownerId, String applicationId) {
    PreparedUndo undo = store.prepare(ownerId, applicationId);
    if (undo.alreadyUndone()) {
      return new Result(applicationId, 0);
    }

    List<Entry> entries = undo.entries();
    for (Entry entry : entries) {
      entry.validate();
    }
    for (Entry entry : entries) {
      entry.restore();
    }

    undo.markUndone();
    if (!entries.isEmpty()) {
      undo.evictAfterCommit();
    }
    return new Result(applicationId, entries.size());
  }

  /** Loads the owned journal under the owner's write lock in the caller's transaction. */
  public interface Store {
    PreparedUndo prepare(String ownerId, String applicationId);
  }

  public interface PreparedUndo {
    boolean alreadyUndone();

    /** Reads journal entries in stored order after the already-undone check. */
    List<Entry> entries();

    void markUndone();

    void evictAfterCommit();
  }

  public interface Entry {
    void validate();

    void restore();
  }

  public record Result(String applicationId, int changed) {}
}
