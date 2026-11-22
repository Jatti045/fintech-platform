package com.fintechapp.fintech_api.categorization.domain;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class HistoricalPreviewPolicyTest {
  @Test
  void emptyMatchesRetainCurrentDisplayWithoutClaimingProtection() {
    var result =
        ClassificationPolicy.historicalPreview("target", List.of(), false, null, null, null);
    assertNull(result.winnerId());
    assertFalse(result.projectsTarget());
    assertFalse(result.protectedOverride());
  }

  @Test
  void firstCurrentMatchWinsAndLosingTargetDoesNotProject() {
    var ordered = new ArrayList<>(List.of("first", "target", "third"));
    var loss = ClassificationPolicy.historicalPreview("target", ordered, false, null, null, null);
    assertEquals("first", loss.winnerId());
    assertFalse(loss.projectsTarget());
    assertFalse(loss.protectedOverride());
    assertTrue(
        ClassificationPolicy.historicalPreview("first", ordered, false, null, null, null)
            .projectsTarget());
    assertEquals(List.of("first", "target", "third"), ordered);
  }

  @Test
  void rulesDisabledKeepsWinnerButRetainsCurrentDisplay() {
    var result =
        ClassificationPolicy.historicalPreview("target", List.of("target"), true, null, null, null);
    assertEquals("target", result.winnerId());
    assertFalse(result.projectsTarget());
    assertTrue(result.protectedOverride());
  }

  @Test
  void nonnullOverridesIncludingBlankAreProtectedWithoutSuppressingWinnerProjection() {
    for (String[] overrides :
        List.of(
            new String[] {"Manual", null, null},
            new String[] {null, "", null},
            new String[] {null, null, " "})) {
      var result =
          ClassificationPolicy.historicalPreview(
              "target", List.of("target"), false, overrides[0], overrides[1], overrides[2]);
      assertEquals("target", result.winnerId());
      assertTrue(result.projectsTarget());
      assertTrue(result.protectedOverride());
    }
  }
}
