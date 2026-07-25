import { createTrainer, infer } from "arkor";

// IOL-AI fine-tuning: train Gemma 4 to solve linguistics olympiad problems
// Starting from the `translate` template — multilingual reasoning is adjacent.
// Each training example: { context (problem data), query (instructions), answer (solutions) }

export const trainer = createTrainer({
  name: "ratiocine-v0",
  model: "google/gemma-4-31b-it",

  dataset: {
    type: "huggingface",
    name: "arkorlab/translate-demo", // placeholder — swap for IOL synthetic dataset
  },

  lora: {
    r: 16,
    alpha: 32,
    dropout: 0.05,
  },

  hyperparameters: {
    maxSteps: 200,
    learningRate: 2e-4,
    warmupSteps: 20,
  },

  callbacks: {
    onLog({ step, loss }) {
      console.log(`step ${step}: loss = ${loss}`);
    },

    onCheckpoint({ step }) {
      // Sanity-check the half-trained model against an IOL-style problem
      const result = infer({
        messages: [
          {
            role: "system",
            content:
              "You solve International Linguistics Olympiad problems. " +
              "Answer every numbered item. Put each answer on its own line.",
          },
          {
            role: "user",
            content:
              "Here are sentences in Hakhun with English:\n" +
              "ŋa ka kɤ ne | Do I go?\n" +
              "nɤ ʒip tuʔ ne | Did you sleep?\n\n" +
              "Translate into English:\nnɤ ʒip ku ne",
          },
        ],
        maxTokens: 128,
      });
      console.log(`checkpoint ${step}: sample answer = "${result}"`);
    },

    onCompleted({ adapterId }) {
      console.log(`training complete — adapter: ${adapterId}`);
    },

    onFailed({ error }) {
      console.error(`training failed: ${error}`);
    },
  },
});
