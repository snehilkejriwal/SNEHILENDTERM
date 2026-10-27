import { z } from 'zod';
import { complete } from './llm.js';
import { coerceFacts } from './coerce.js';
import { AppError } from '../../utils/AppError.js';

const responseSchema = z.object({
  facts: z.record(z.string(), z.any()).default({}),
  lowConfidence: z.array(z.string()).default([]),
});

function describeField(f) {
  let type = f.type;
  if (f.type === 'enum') type = `one of ${f.options.map((o) => `"${o.value}"`).join(', ')}`;
  if (f.type === 'date') type = 'date as YYYY-MM-DD';
  if (f.type === 'datetime') type = 'date-time as ISO 8601 with +05:30 offset if the timezone is Indian';
  if (f.type === 'number') type = `number${f.unit ? ` in ${f.unit}` : ''}, digits only`;
  return `- ${f.key} (${type}): ${f.label}${f.help ? `. ${f.help}` : ''}`;
}

// The AI only reads documents. It never decides anything about the case.
export async function extractFacts(pack, text) {
  const system = [
    'You extract facts from Indian legal and consumer documents into JSON.',
    'Only report what the documents state or directly imply. Never guess or invent values; omit a field you cannot find.',
    'List in "lowConfidence" any field keys whose values you inferred rather than read directly.',
    'Respond with JSON only: {"facts": {...}, "lowConfidence": [...]}.',
  ].join(' ');
  const user = `Case type: ${pack.name}\nFields to extract:\n${pack.factSchema.map(describeField).join('\n')}\n\nDocuments:\n"""\n${text}\n"""`;

  const raw = await complete(system, user);
  let json;
  try {
    // Some models wrap the JSON in code fences or a sentence; take the outermost {...} block.
    const body = raw.replace(/```json|```/g, '');
    json = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
  } catch {
    throw new AppError(502, 'The document reader returned something unreadable. Enter the facts by hand to continue.');
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new AppError(502, 'The document reader returned an unexpected format. Enter the facts by hand to continue.');

  const { facts, errors } = coerceFacts(pack.factSchema, parsed.data.facts);
  const known = new Set(pack.factSchema.map((f) => f.key));
  return {
    facts,
    lowConfidence: parsed.data.lowConfidence.filter((k) => known.has(k)),
    warnings: Object.values(errors),
  };
}
