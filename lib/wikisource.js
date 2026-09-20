const API = "https://en.wikisource.org/w/api.php";
const WORK = "Consider_the_Consequences!";

function decodeEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10))
    )
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all);
}

function htmlToParagraphs(html) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<table[\s\S]*?<\/table>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<sup[\s\S]*?<\/sup>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t\r\f\v]+/g, " ").replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => !/^Image$/i.test(p))
    .filter((p) => !/^Retrieved from /i.test(p));
}

function normalizeTarget(letter, number) {
  return `${letter.toUpperCase()}-${Number(number)}`;
}

function targetIds(choiceParagraph) {
  const ids = [];
  const seen = new Set();
  for (const match of choiceParagraph.matchAll(/\b([HJS])[.\-](\d{1,2})\b/gi)) {
    const id = normalizeTarget(match[1], match[2]);
    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}

function cleanChoicePrefix(value) {
  return value
    .replace(/^(?:while\s+)?(?:the\s+)?reader\s+who\s+/i, "")
    .replace(/^(?:while\s+)?the\s+one\s+who\s+/i, "")
    .replace(/^one\s+who\s+/i, "")
    .replace(/^decides\s+that\s+/i, "")
    .replace(/^thinks\s+that\s+/i, "")
    .replace(/^wishes\s+/i, "")
    .replace(/^wants\s+/i, "")
    .replace(/^decides\s+/i, "")
    .replace(/[,;:.\s]+$/g, "")
    .trim();
}

function choiceLabel(paragraph, target) {
  const [letter, number] = target.split("-");
  const escaped = `${letter}[.\\-]${number}`;
  const matcher = new RegExp(
    `([\\s\\S]*?)(?:turns?|goes?)\\s+to\\s+(?:paragraphs?\\s+)?${escaped}`,
    "i"
  );
  const match = paragraph.match(matcher);
  if (!match) return `Continue to ${target}`;

  let clause = match[1].trim();
  const separator = Math.max(
    clause.lastIndexOf(". "),
    clause.lastIndexOf("; "),
    clause.lastIndexOf(": ")
  );
  if (separator >= 0) clause = clause.slice(separator + 2);

  clause = cleanChoicePrefix(clause);
  return clause || `Continue to ${target}`;
}

function stripHeadings(paragraphs, node) {
  return paragraphs.filter((p, index) => {
    if (index > 2) return true;
    if (p === node) return false;
    if (/^[HJS]-\d+$/.test(p)) return false;
    if (/^Section\s+[IVX]+$/i.test(p)) return false;
    if (/^Section\s+[IVX]+\s+(Helen|Jed|Saunders)$/i.test(p)) return false;
    if (/^(Helen|Jed|Saunders)$/i.test(p)) return false;
    return true;
  });
}

export async function loadConsiderScene(node) {
  const page = `${WORK}/${node}`;
  const url =
    `${API}?action=parse&format=json&formatversion=2&prop=text&page=` +
    encodeURIComponent(page);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "KIRO/0.1 (https://github.com/Unjuno/kiro)"
    },
    next: { revalidate: 86400 }
  });

  if (!response.ok) {
    throw new Error(`Wikisource returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error || !data?.parse?.text) {
    throw new Error(data?.error?.info || "Scene not found");
  }

  let paragraphs = stripHeadings(htmlToParagraphs(data.parse.text), node);
  const choiceIndex = paragraphs.findIndex((p) =>
    /turns?\s+to\s+(?:paragraphs?\s+)?[HJS][.\-]\d+/i.test(p)
  );

  let choiceParagraph = "";
  if (choiceIndex >= 0) {
    choiceParagraph = paragraphs[choiceIndex];
    paragraphs = paragraphs.slice(0, choiceIndex);
  }

  const targets = choiceParagraph ? targetIds(choiceParagraph) : [];
  const choices = targets.map((target) => ({
    target,
    label: choiceLabel(choiceParagraph, target)
  }));

  return {
    node,
    text: paragraphs.join("\n\n"),
    choices,
    isEnding: choices.length === 0,
    sourceUrl: `https://en.wikisource.org/wiki/${encodeURIComponent(WORK)}/${encodeURIComponent(node)}`
  };
}
