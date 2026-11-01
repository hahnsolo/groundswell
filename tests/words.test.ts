import { describe, expect, it } from "vitest";
import { countWords, descriptionProblem, MAX_DESCRIPTION_WORDS, MIN_DESCRIPTION_WORDS } from "@/lib/words";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("counting words", () => {
  it("counts plain words", () => {
    expect(countWords("The crossing at Elm and 5th has no lights")).toBe(9);
  });

  it("ignores extra spaces and line breaks", () => {
    expect(countWords("  one   two\n\nthree\tfour  ")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("   \n  ")).toBe(0);
  });

  it("doesn't count punctuation or emoji on their own", () => {
    expect(countWords("Fix it !!! — now 🙏 ...")).toBe(3);
  });

  it("counts a link, a number or a hyphenated word as one", () => {
    expect(countWords("see https://toronto.ca/roads/report?id=12 at 5th-and-Elm by 2027")).toBe(6);
  });

  it("counts accented words and other alphabets", () => {
    expect(countWords("Le trottoir près de l'école est brisé")).toBe(7);
  });
});

describe("description rules", () => {
  it(`needs at least ${MIN_DESCRIPTION_WORDS} words`, () => {
    expect(descriptionProblem(words(MIN_DESCRIPTION_WORDS - 1))).toMatch(/At least 50 words/);
    expect(descriptionProblem(words(MIN_DESCRIPTION_WORDS))).toBeNull();
  });

  it("can't be padded with punctuation", () => {
    expect(descriptionProblem(`${words(20)} ${"! ".repeat(100)}`)).toMatch(/At least/);
  });

  it(`allows up to ${MAX_DESCRIPTION_WORDS} words`, () => {
    expect(descriptionProblem(words(MAX_DESCRIPTION_WORDS))).toBeNull();
    expect(descriptionProblem(words(MAX_DESCRIPTION_WORDS + 1))).toMatch(/under 1000 words/);
  });
});
