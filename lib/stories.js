export const STORIES = {
  "consider-the-consequences": {
    id: "consider-the-consequences",
    title: "Consider the Consequences!",
    authors: ["Doris Webster", "Mary Alden Hopkins"],
    year: 1930,
    sourceLanguage: "English",
    sourceUrl: "https://en.wikisource.org/wiki/Consider_the_Consequences!",
    rights:
      "Original work: public domain in the United States. Rights may differ by jurisdiction. Source transcription is fetched from Wikisource.",
    description: {
      en: "A pioneering branching novel about love, work, family, money, and the consequences of ordinary decisions — with 43 endings across three connected lives.",
      ja: "恋愛、仕事、家族、金、そして日常の選択が人生をどう変えるかを描く初期の分岐小説。3人の人生が交差し、全43の結末を持ちます。"
    },
    starts: [
      { node: "Helen", label: "Helen Rogers" },
      { node: "Jed", label: "Jed Harringdale" },
      { node: "Saunders", label: "Saunders Mead" }
    ]
  }
};

export function storyDescription(story, lang) {
  return lang && String(lang).toLowerCase().startsWith("ja")
    ? story.description.ja
    : story.description.en;
}
