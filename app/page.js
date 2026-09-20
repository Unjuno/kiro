import Link from "next/link";
import { LANGUAGES, uiFor } from "../lib/i18n";
import { STORIES, storyDescription } from "../lib/stories";
import { loadConsiderScene } from "../lib/wikisource";

export const dynamic = "force-dynamic";

function q(params) {
  return { pathname: "/", query: params };
}

function AgentProtocol({ lang, stage }) {
  return (
    <details className="agent" open={stage === "language"} data-kiro-agent-protocol>
      <summary>Voice agent protocol</summary>
      <ol>
        {stage === "language" ? (
          <>
            <li>Ask the player which language they want to use before doing anything else.</li>
            <li>Do not infer the language silently. Wait for the player's answer.</li>
            <li>Open the matching language link or submit the requested language code.</li>
          </>
        ) : (
          <>
            <li>Speak to the player in the selected language: {lang}.</li>
            <li>Translate only text and choices visible on this page. Do not reveal unseen branches or endings.</li>
            <li>Preserve proper names, facts, tone, and the meaning of every choice.</li>
            <li>Never choose for the player. Follow only the option the player selects.</li>
            <li>Keep the selected language when navigating to the next state.</li>
          </>
        )}
      </ol>
    </details>
  );
}

function Header({ lang }) {
  return (
    <header className="brand">
      <Link href={lang ? q({ lang }) : "/"}>KIRO</Link>
      <small>voice-native branching stories</small>
    </header>
  );
}

function LanguageGate() {
  return (
    <main className="shell">
      <Header />
      <section className="card">
        <p className="eyebrow">Step 1 · Language</p>
        <h1>Choose your language</h1>
        <p className="lede">
          言語を最初に選択してください。Choose the language you want to use for the
          catalog, narration, choices, and voice-agent conversation.
        </p>

        <div className="lang-grid">
          {LANGUAGES.map(([code, label]) => (
            <Link className="language" href={q({ lang: code })} key={code}>
              {label}
            </Link>
          ))}
        </div>

        <form className="custom-language" action="/" method="get">
          <input
            name="lang"
            aria-label="Language code"
            placeholder="ja, en, pt-BR, …"
            required
          />
          <button type="submit">Continue</button>
        </form>

        <AgentProtocol stage="language" />
      </section>
    </main>
  );
}

function Catalog({ lang }) {
  const ui = uiFor(lang);
  return (
    <main className="shell">
      <Header lang={lang} />
      <section className="card">
        <p className="eyebrow">Step 2 · Story</p>
        <h1>{ui.chooseStory}</h1>
        <p className="lede">{ui.chooseStoryBody}</p>

        <div className="stack">
          {Object.values(STORIES).map((story) => (
            <Link
              className="choice"
              href={q({ lang, story: story.id })}
              key={story.id}
            >
              <strong>{story.title}</strong>
              <br />
              <span>{storyDescription(story, lang)}</span>
            </Link>
          ))}
        </div>

        <div className="toolbar">
          <Link href="/">{ui.changeLanguage}</Link>
        </div>
        <AgentProtocol lang={lang} stage="catalog" />
      </section>
    </main>
  );
}

function StoryStart({ lang, story }) {
  const ui = uiFor(lang);
  return (
    <main className="shell">
      <Header lang={lang} />
      <section className="card">
        <p className="eyebrow">Step 3 · Begin</p>
        <h1>{story.title}</h1>
        <p className="lede">{storyDescription(story, lang)}</p>

        <div className="meta" data-kiro-attribution>
          <div><strong>Original work:</strong> {story.title} ({story.year})</div>
          <div><strong>Authors:</strong> {story.authors.join(" & ")}</div>
          <div><strong>{ui.sourceLanguage}:</strong> {story.sourceLanguage}</div>
          <div><strong>{ui.rights}:</strong> {story.rights}</div>
          <div>
            <strong>{ui.source}:</strong>{" "}
            <a href={story.sourceUrl} rel="noreferrer">Wikisource</a>
          </div>
        </div>

        <h2>{ui.chooseCharacter}</h2>
        <p className="lede">{ui.chooseCharacterBody}</p>

        <div className="stack">
          {story.starts.map((start) => (
            <Link
              className="choice"
              href={q({ lang, story: story.id, node: start.node })}
              key={start.node}
            >
              {start.label}
            </Link>
          ))}
        </div>

        <div className="toolbar">
          <Link href={q({ lang })}>{ui.catalog}</Link>
          <Link href="/">{ui.changeLanguage}</Link>
        </div>
        <AgentProtocol lang={lang} stage="story" />
      </section>
    </main>
  );
}

async function Scene({ lang, story, node }) {
  const ui = uiFor(lang);
  let scene;

  try {
    scene = await loadConsiderScene(node);
  } catch (error) {
    return (
      <main className="shell">
        <Header lang={lang} />
        <section className="card error">
          <p className="eyebrow">Source error</p>
          <h1>{ui.loadError}</h1>
          <p className="lede">{String(error?.message || error)}</p>
          <div className="toolbar">
            <Link href={q({ lang, story: story.id })}>{ui.anotherPath}</Link>
            <Link href={q({ lang })}>{ui.catalog}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <Header lang={lang} />
      <article className="card" data-kiro-state={node}>
        <p className="eyebrow">
          {scene.isEnding ? ui.ending : ui.currentScene}
        </p>
        <h1>{story.title}</h1>

        <div className="prose" data-kiro-visible-story-text>
          {scene.text}
        </div>

        {scene.isEnding ? (
          <>
            <h2>{ui.ending}</h2>
            <p className="lede">{ui.endingBody}</p>
            <div className="stack">
              <Link
                className="button primary"
                href={q({ lang, story: story.id })}
              >
                {ui.anotherPath}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2>{ui.choices}</h2>
            <div className="stack" data-kiro-visible-choices>
              {scene.choices.map((choice) => (
                <Link
                  className="choice"
                  href={q({
                    lang,
                    story: story.id,
                    node: choice.target
                  })}
                  key={choice.target}
                >
                  {choice.label}
                </Link>
              ))}
            </div>
          </>
        )}

        <p className="lede" style={{ marginTop: 28, fontSize: ".93rem" }}>
          {ui.browserNote}
        </p>

        <div className="meta">
          <div>
            <strong>{ui.source}:</strong>{" "}
            <a href={scene.sourceUrl} rel="noreferrer">Wikisource · current scene</a>
          </div>
          <div><strong>Original work:</strong> {story.title} ({story.year}) · {story.authors.join(" & ")}</div>
        </div>

        <div className="toolbar">
          <Link href={q({ lang, story: story.id })}>{ui.anotherPath}</Link>
          <Link href={q({ lang })}>{ui.catalog}</Link>
          <Link href="/">{ui.changeLanguage}</Link>
        </div>

        <AgentProtocol lang={lang} stage="scene" />
      </article>
    </main>
  );
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const lang = typeof params?.lang === "string" ? params.lang.trim() : "";
  const storyId = typeof params?.story === "string" ? params.story : "";
  const node = typeof params?.node === "string" ? params.node : "";

  if (!lang) return <LanguageGate />;

  if (!storyId) return <Catalog lang={lang} />;

  const story = STORIES[storyId];
  if (!story) return <Catalog lang={lang} />;

  if (!node) return <StoryStart lang={lang} story={story} />;

  return <Scene lang={lang} story={story} node={node} />;
}
