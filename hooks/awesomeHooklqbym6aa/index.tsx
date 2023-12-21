
enum Order {
  Highest = 4,
  High = 3,
  Medium = 2,
  Low = 1,
  Lowest = 0,
}

async function* hook(
  {
    input,
    config,
    chat,
    thread,
  }: {
    input: string;
    config: Record<string, string>;
    chat: {
      prompts: {
        base: string;
        restriction: string;
      };
      model: string;
      inputTokenLimit: number;
      outputTokenLimit: number;
      temperature: number;
    };
    thread: {
      history: Message[];
      context: Message[];
      values: Record<string, string>;
    };
  },
  sdk: SDK,
): AsyncGenerator<AppEvent> {
  yield* sdk.openai.stream(
    /*
      If number of tokens exceeds input token limit
      set in the chat, we trim the messages in the
      following order:
        - take the user input + restriction prompt first
        - if there's space, take the base prompt
        - if there's space, take history messages, up to 40% of the remaining space, or 1000 tokens, whichever is lower
        - in the remaining space, take the messages from context
    */
    [
      [
        Order.High,
        {
          role: "system",
          content: chat.prompts.base,
        },
      ],

      [
        Order.Low,
        {
          messages: thread.context,
          limit: {
            // memories are sorted by relevance, from highest to lowest
            // hence we want to trim from the end and keep the most relevant messages first
            from: "end",
          },
        },
      ],

      [
        Order.Medium,
        {
          messages: thread.history,
          limit: {
            // maximum of 40% of available space, or 1000 tokens, whichever is lower
            tokens: [0.4, 1000],
            // trim from the start, which contains the older messages
            from: "start",
          },
        },
      ],

      [
        Order.Highest,
        {
          role: "system",
          content: sdk.template(
            `
Respond to the following message based on the information in [[CONTEXT]] above.
<human>
{{input}}
</human>

{{restriction}}`,
            {
              input,
              restriction: chat.prompts.restriction,
            },
          ),
        },
      ],
    ],
    {
      model: chat.model,
      apiKey: config.OPENAI_KEY,
      maxTokens: chat.outputTokenLimit,
      maxPromptTokens: chat.inputTokenLimit,
      temperature: chat.temperature,
      stop: [],
    },
  );
}
