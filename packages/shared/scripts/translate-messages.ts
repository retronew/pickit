// Drafts missing translations with an OpenAI-compatible chat API.
//
//   I18N_AI_BASE_URL=https://api.openai.com/v1 I18N_AI_KEY=sk-… I18N_AI_MODEL=gpt-4.1-mini \
//     pnpm i18n:translate [--dry-run] [--locale en,ja] [--keys a,b] [--messages dir]
//
// Source is messages/zh.json. Drafts whose {placeholders} don't match the
// source are skipped and reported. Review the diff before committing.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANGUAGE_NAMES,
  batches,
  mergeCatalog,
  missingKeys,
  rejectDraft,
  translationPrompt,
  type Catalog,
} from "../src/i18n-tools.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = flag("--messages") ?? join(dirname(fileURLToPath(import.meta.url)), "../messages");
const dryRun = args.includes("--dry-run");
const locales = (flag("--locale") ?? "en,ja").split(",");
const onlyKeys = flag("--keys")?.split(",");

const read = (locale: string): Catalog => JSON.parse(readFileSync(join(dir, `${locale}.json`), "utf8"));
const base = read("zh");

async function translate(language: string, texts: Catalog): Promise<Record<string, unknown>> {
  const { I18N_AI_BASE_URL, I18N_AI_KEY, I18N_AI_MODEL } = process.env;
  if (!I18N_AI_BASE_URL || !I18N_AI_KEY || !I18N_AI_MODEL) {
    throw new Error("Set I18N_AI_BASE_URL, I18N_AI_KEY and I18N_AI_MODEL (any OpenAI-compatible API).");
  }
  const res = await fetch(`${I18N_AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${I18N_AI_KEY}` },
    body: JSON.stringify({
      model: I18N_AI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: translationPrompt(language) },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices[0].message.content;
  return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
}

let failed = 0;
for (const locale of locales) {
  const target = read(locale);
  const keys = onlyKeys ?? missingKeys(base, target);
  console.log(`${locale}: ${keys.length} to translate`);
  if (!keys.length || dryRun) {
    if (dryRun) for (const k of keys) console.log(`  ${k}: ${base[k]}`);
    continue;
  }
  const drafts: Catalog = {};
  for (const batch of batches(keys, 40)) {
    const result = await translate(LANGUAGE_NAMES[locale] ?? locale, Object.fromEntries(batch.map((k) => [k, base[k]])));
    for (const key of batch) {
      const problem = rejectDraft(base[key], result[key]);
      if (problem) {
        failed++;
        console.warn(`  skipped ${key}: ${problem}`);
      } else {
        drafts[key] = String(result[key]);
      }
    }
  }
  writeFileSync(join(dir, `${locale}.json`), `${JSON.stringify(mergeCatalog(target, drafts), null, 2)}\n`);
  console.log(`  wrote ${Object.keys(drafts).length}`);
}
if (failed) {
  console.warn(`${failed} drafts skipped; translate them by hand.`);
  process.exitCode = 1;
}
