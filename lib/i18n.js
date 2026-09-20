export const LANGUAGES = [
  ["ja", "日本語"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ko", "한국어"],
  ["zh-CN", "简体中文"]
];

const COPY = {
  en: {
    chooseLanguage: "Choose your language",
    chooseLanguageBody:
      "Language comes first. KIRO will keep this choice while you browse stories and play.",
    customLanguage: "Other language code",
    continue: "Continue",
    chooseStory: "Choose a story",
    chooseStoryBody:
      "KIRO reveals only the current state of a branching story. Your next choice determines what becomes visible.",
    play: "Play this story",
    source: "Source",
    rights: "Rights",
    sourceLanguage: "Source language",
    chooseCharacter: "Choose whose consequences to follow",
    chooseCharacterBody:
      "This 1930 interactive novel follows three connected lives. Pick a viewpoint to begin.",
    currentScene: "Current scene",
    choices: "What happens next?",
    ending: "Ending reached",
    endingBody: "This path has reached one of the story's endings.",
    anotherPath: "Try another path",
    catalog: "Story catalog",
    changeLanguage: "Change language",
    loadError: "The source scene could not be loaded.",
    browserNote:
      "Browser mode shows the canonical source text. A live voice agent should translate the visible scene and choices into your selected language in real time."
  },
  ja: {
    chooseLanguage: "言語を選択",
    chooseLanguageBody:
      "KIROでは言語設定が最初です。選んだ言語は、作品選択からプレイ中まで維持されます。",
    customLanguage: "その他の言語コード",
    continue: "続ける",
    chooseStory: "物語を選ぶ",
    chooseStoryBody:
      "KIROは分岐物語の現在の状態だけを表示します。次に選んだ選択肢によって、その先だけが開きます。",
    play: "この物語を遊ぶ",
    source: "出典",
    rights: "権利",
    sourceLanguage: "原文",
    chooseCharacter: "誰の人生を追うか選ぶ",
    chooseCharacterBody:
      "1930年のこのインタラクティブ小説は、3人の人生が交差します。視点を選んで開始します。",
    currentScene: "現在の場面",
    choices: "どうする？",
    ending: "エンディング",
    endingBody: "このルートは物語の結末に到達しました。",
    anotherPath: "別のルートを試す",
    catalog: "作品一覧",
    changeLanguage: "言語を変更",
    loadError: "原文の場面を取得できませんでした。",
    browserNote:
      "ブラウザ単体では原文を表示します。ライブ音声エージェントでは、現在表示されている場面と選択肢だけを、選択言語へ逐次翻訳して進行します。"
  }
};

export function uiFor(lang) {
  const base = String(lang || "en").toLowerCase();
  if (base === "ja" || base.startsWith("ja-")) return COPY.ja;
  return COPY.en;
}
