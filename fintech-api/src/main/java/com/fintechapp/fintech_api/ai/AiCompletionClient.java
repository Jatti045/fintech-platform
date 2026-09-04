package com.fintechapp.fintech_api.ai;

/**
 * The single seam between Budgee's financial logic and any AI provider.
 *
 * <p>Implementations translate a system prompt + user content into one
 * completion. Providers are swapped through configuration ({@code app.ai.*});
 * no business logic ever references a specific vendor.</p>
 */
public interface AiCompletionClient {

    /**
     * Returns one completion for the given messages.
     *
     * @throws AiClientException on configuration problems, provider errors,
     *                           timeouts, or unusable responses
     */
    String complete(String systemPrompt, String userContent);
}
