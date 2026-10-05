// How one sequence step becomes the email a recipient reads. Shared by the
// Smartlead launch (which sends these paragraphs as plain text) and the Sequence
// step's preview, so what the reviewer sees is what gets sent.

export type EmailParts = {
  hook: string;
  content: string;
  cta: string;
  ps: string;
};

// The generator deliberately keeps "hook" specific rather than a greeting
// (see /api/sequence's system prompt), so every email would otherwise read
// as a template with no salutation — prepend a plain "Hi {{firstName}},"
// here, guaranteed regardless of what the model drafted.
export function emailParagraphs(step: EmailParts): string[] {
  return [
    "Hi {{firstName}},",
    step.hook,
    step.content,
    step.cta,
    step.ps && `P.S. ${step.ps}`,
  ].filter((p): p is string => !!p && p.trim().length > 0);
}

export type MergeValues = { firstName: string; title: string; company: string };

// Fills the generator's merge tokens with one recipient's values, for preview.
export function fillMergeTokens(text: string, values: MergeValues): string {
  return text
    .replace(/{{\s*firstName\s*}}/g, values.firstName)
    .replace(/{{\s*title\s*}}/g, values.title)
    .replace(/{{\s*company\s*}}/g, values.company);
}
