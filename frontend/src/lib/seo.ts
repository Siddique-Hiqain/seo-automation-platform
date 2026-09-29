import type { FaqItem } from "./types";
import { isHtml, plainText, startsWithH1, wordCount } from "./utils";

export interface Faq {
  question: string;
  answer: string;
}

/** The LLM returns FAQs in a few shapes; normalize them for editing. */
export function normalizeFaq(items: FaqItem[] | null | undefined): Faq[] {
  return (items ?? []).map((item) => {
    if (typeof item === "string") return { question: item, answer: "" };
    return { question: item.question ?? item.q ?? "", answer: item.answer ?? item.a ?? "" };
  });
}

export const LIMITS = {
  metaTitle: { min: 30, ideal: [50, 60] as const, max: 60 },
  metaDescription: { min: 70, ideal: [120, 160] as const, max: 160 },
};

export type CheckState = "pass" | "warn" | "fail";
export interface Check {
  label: string;
  detail: string;
  state: CheckState;
}

const stripMarkup = (s: string) => plainText(s).replace(/\s+/g, " ").toLowerCase();

export function analyzeArticle(input: {
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  faq: Faq[];
  keyword?: string;
}): { checks: Check[]; score: number } {
  const { title, metaTitle, metaDescription, content, faq } = input;
  const keyword = input.keyword?.trim().toLowerCase();
  const plain = stripMarkup(content);
  const words = wordCount(plain);
  const firstPara = plain.slice(0, 600);
  const headings = (content.match(/^#{2,3}\s|<h[23][\s>]/gim) ?? []).length;
  const checks: Check[] = [];

  const mt = metaTitle.length;
  checks.push({
    label: "Meta title length",
    detail: `${mt} characters (aim for 50–60)`,
    state: mt >= 50 && mt <= 60 ? "pass" : mt >= 30 && mt <= 70 ? "warn" : "fail",
  });

  const md = metaDescription.length;
  checks.push({
    label: "Meta description length",
    detail: `${md} characters (aim for 120–160)`,
    state: md >= 120 && md <= 160 ? "pass" : md >= 70 && md <= 180 ? "warn" : "fail",
  });

  checks.push({
    label: "Content length",
    detail: `${words.toLocaleString()} words (1,200+ recommended for long-form)`,
    state: words >= 1200 ? "pass" : words >= 600 ? "warn" : "fail",
  });

  checks.push({
    label: "Section headings",
    detail: headings ? `${headings} H2/H3 headings` : "Add H2/H3 headings to structure the article",
    state: headings >= 3 ? "pass" : headings >= 1 ? "warn" : "fail",
  });

  checks.push({
    label: "FAQ section",
    detail: `${faq.length} question${faq.length === 1 ? "" : "s"} (3+ can win rich results)`,
    state: faq.length >= 3 ? "pass" : faq.length >= 1 ? "warn" : "fail",
  });

  if (keyword) {
    const inTitle = (title + " " + metaTitle).toLowerCase().includes(keyword);
    checks.push({
      label: "Keyword in title",
      detail: `“${keyword}”`,
      state: inTitle ? "pass" : "warn",
    });
    checks.push({
      label: "Keyword in meta description",
      detail: `“${keyword}”`,
      state: metaDescription.toLowerCase().includes(keyword) ? "pass" : "warn",
    });
    checks.push({
      label: "Keyword in introduction",
      detail: "Mention the focus keyword early",
      state: firstPara.includes(keyword) ? "pass" : "warn",
    });
  }

  const points = checks.reduce((sum, c) => sum + (c.state === "pass" ? 1 : c.state === "warn" ? 0.5 : 0), 0);
  return { checks, score: Math.round((points / checks.length) * 100) };
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Builds a downloadable file in the article's own format (HTML or Markdown), including meta and FAQs. */
export function toExportDocument(a: { title: string; metaTitle: string; metaDescription: string; content: string; faq: Faq[] }) {
  const faq = a.faq.filter((f) => f.question.trim());
  const hasH1 = startsWithH1(a.content);

  if (isHtml(a.content)) {
    const faqHtml = faq.length
      ? ["<h2>Frequently Asked Questions</h2>", ...faq.map((f) => `<h3>${escHtml(f.question)}</h3>\n<p>${escHtml(f.answer)}</p>`)].join("\n")
      : "";
    const body = [hasH1 ? "" : `<h1>${escHtml(a.title)}</h1>`, a.content.trim(), faqHtml].filter(Boolean).join("\n\n");
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8" />',
      `<title>${escHtml(a.metaTitle || a.title)}</title>`,
      `<meta name="description" content="${escHtml(a.metaDescription)}" />`,
      "</head>",
      "<body>",
      body,
      "</body>",
      "</html>",
      "",
    ].join("\n");
    return { text: html, ext: "html", mime: "text/html" };
  }

  const esc = (s: string) => s.replace(/"/g, '\\"');
  const md = [
    "---",
    `title: "${esc(a.title)}"`,
    `meta_title: "${esc(a.metaTitle)}"`,
    `meta_description: "${esc(a.metaDescription)}"`,
    "---",
    "",
    ...(hasH1 ? [] : [`# ${a.title}`, ""]),
    a.content.trim(),
    ...(faq.length
      ? ["", "## Frequently Asked Questions", "", ...faq.flatMap((f) => [`### ${f.question}`, "", f.answer, ""])]
      : []),
  ].join("\n");
  return { text: md, ext: "md", mime: "text/markdown" };
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "article"
  );
}
