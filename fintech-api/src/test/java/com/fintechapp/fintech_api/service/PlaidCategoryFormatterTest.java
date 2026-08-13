package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class PlaidCategoryFormatterTest {

    private final PlaidCategoryFormatter formatter = new PlaidCategoryFormatter();

    @ParameterizedTest
    @MethodSource("knownConversions")
    void toReadableCategory_knownInputs_convertCorrectly(String raw, String expected) {
        assertEquals(expected, formatter.toReadableCategory(raw));
    }

    static Stream<Arguments> knownConversions() {
        return Stream.of(
                // Legacy coarse enum codes
                Arguments.of("FOOD_AND_DRINK", "Food & Drink"),
                Arguments.of("TRAVEL", "Travel"),
                Arguments.of("GROCERIES", "Groceries"),
                Arguments.of("TRANSPORTATION", "Transportation"),
                Arguments.of("RENT_AND_UTILITIES", "Rent & Utilities"),
                Arguments.of("HEALTH_AND_FITNESS", "Health & Fitness"),
                // Hierarchical values split into sections
                Arguments.of("Travel:Air Travel", "Travel / Air Travel"),
                Arguments.of("Food and Drink:Dining Out", "Food & Drink / Dining Out"),
                Arguments.of("FOOD_AND_DRINK:FAST_FOOD", "Food & Drink / Fast Food"),
                Arguments.of("Transportation:Gas", "Transportation / Gas"),
                // Alternate separators: / | and backslash
                Arguments.of("Travel/Air Travel", "Travel / Air Travel"),
                Arguments.of("Travel|Air Travel", "Travel / Air Travel"),
                Arguments.of("Travel\\Air Travel", "Travel / Air Travel"),
                // Case normalisation
                Arguments.of("transportation:gas", "Transportation / Gas"),
                Arguments.of("TRAVEL:AIR TRAVEL", "Travel / Air Travel"),
                Arguments.of("already Formatted", "Already Formatted"),
                Arguments.of("camelCase", "Camel Case"),
                // Acronym preservation
                Arguments.of("US_POSTAGE", "US Postage"),
                Arguments.of("TV_SUBSCRIPTION", "TV Subscription"),
                // Connectors become ampersands
                Arguments.of("PETS_AND_SUPPLIES", "Pets & Supplies"),
                Arguments.of("TRANSFER_IN_AND_OUT", "Transfer In & Out"),
                // Whitespace tolerance
                Arguments.of("  GROCERIES  ", "Groceries"),
                Arguments.of("Travel : Air Travel", "Travel / Air Travel")
        );
    }

    @ParameterizedTest
    @MethodSource("fallbackInputs")
    void toReadableCategory_fallbackInputs_returnOther(String raw) {
        assertEquals("Other", formatter.toReadableCategory(raw));
    }

    static Stream<Arguments> fallbackInputs() {
        return Stream.of(
                Arguments.of((Object) null),
                Arguments.of(""),
                Arguments.of("   "),
                Arguments.of(":::||"),
                Arguments.of("/"),
                Arguments.of("  /  ")
        );
    }

    // ── Additional edge cases ────────────────────────────────────────────────

    @Test
    void toReadableCategory_unmappedCode_stillTitleCases() {
        assertEquals("Unknown Code", formatter.toReadableCategory("UNKNOWN_CODE"));
    }

    @Test
    void toReadableCategory_mixedHierarchyAndAmpersand_joinsSections() {
        assertEquals("Food & Drink / Fast Food", formatter.toReadableCategory("FOOD_AND_DRINK:FAST_FOOD"));
    }

    @Test
    void toReadableCategory_deepHierarchy_joinsAllSections() {
        assertEquals("A / B / C", formatter.toReadableCategory("A:B:C"));
    }

    @Test
    void toReadableCategory_singleWord_preservesCaseInsensitively() {
        assertEquals("Coffee", formatter.toReadableCategory("coffee"));
    }
}
