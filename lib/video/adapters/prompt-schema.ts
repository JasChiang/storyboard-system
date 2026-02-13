export interface PromptSchemaInput {
  heading: string;
  shotGoal: string;
  cameraPlan: string;
  subjectState: string[];
  identityInvariants: string[];
  hardNegatives: string[];
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of lines) {
    const line = normalizeLine(raw);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }

  return result;
}

function section(title: string, lines: string[]): string {
  const cleaned = dedupe(lines);
  if (!cleaned.length) return '';
  return `${title}: ${cleaned.join(' ')}`;
}

export function buildPromptFromSchema(input: PromptSchemaInput): string {
  const parts = [
    input.heading,
    section('Shot goal', [input.shotGoal]),
    section('Camera motion', [input.cameraPlan]),
    section('Subject state', input.subjectState),
    section('Identity invariants', input.identityInvariants),
    section('Hard negatives', input.hardNegatives),
  ].filter(Boolean);

  return parts.join(' ');
}
