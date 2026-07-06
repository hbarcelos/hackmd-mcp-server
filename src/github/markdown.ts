export interface RenderMarkdownInput {
  content: string;
  title?: string;
  tags?: string[];
  includeTitleTags?: boolean;
}

export interface ParseMarkdownForHackMdImportInput {
  content: string;
  filePath: string;
}

export interface ParsedMarkdownForHackMdImport {
  content: string;
  title: string;
  tags?: string[];
  hadTitleTagsFrontmatter: boolean;
  normalizedContent: string;
}

export function renderMarkdownForGitHubSync(input: RenderMarkdownInput): string {
  if (input.includeTitleTags === false) {
    return input.content;
  }

  const parsed = parseFrontmatter(input.content);
  const tags = cleanTags(input.tags);
  const metadata = {
    ...parsed.metadata,
    ...(input.title ? { title: input.title } : {}),
    ...(tags ? { tags } : {}),
  };
  if (!tags) {
    delete metadata.tags;
  }

  return `${serializeFrontmatter(metadata)}${parsed.body.startsWith("\n") ? parsed.body : `\n${parsed.body}`}`;
}

export function parseMarkdownForHackMdImport(input: ParseMarkdownForHackMdImportInput): ParsedMarkdownForHackMdImport {
  const parsed = parseFrontmatter(input.content);
  const normalizedContent = normalizeMarkdownForHackMdImport(input);
  const normalized = parseFrontmatter(normalizedContent);
  const title = scalarValue(normalized.metadata.title) ?? titleFromFilePath(input.filePath);
  const tags = arrayValue(normalized.metadata.tags);

  return {
    content: normalized.body.replace(/^\n/, ""),
    title,
    tags,
    hadTitleTagsFrontmatter: Boolean(parsed.metadata.title || parsed.metadata.tags),
    normalizedContent,
  };
}

export function normalizeMarkdownForHackMdImport(input: ParseMarkdownForHackMdImportInput): string {
  const parsed = parseFrontmatter(input.content);
  const title =
    scalarValue(parsed.metadata.title) ?? titleFromHeading(parsed.body) ?? titleFromFilePath(input.filePath);
  const tags = arrayValue(parsed.metadata.tags);
  const metadata = {
    ...parsed.metadata,
    title,
    ...(tags ? { tags } : {}),
  };
  if (!tags) {
    delete metadata.tags;
  }

  return `${serializeFrontmatter(metadata)}${parsed.body.startsWith("\n") ? parsed.body : `\n${parsed.body}`}`;
}

function parseFrontmatter(content: string): { metadata: Record<string, string | string[]>; body: string } {
  if (!content.startsWith("---\n")) {
    return { metadata: {}, body: content };
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return { metadata: {}, body: content };
  }

  const yaml = content.slice(4, end);
  const metadata: Record<string, string | string[]> = {};
  const lines = yaml.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const scalar = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!scalar) {
      continue;
    }

    const [, key, value] = scalar;
    if (value) {
      metadata[key] = unquoteYamlScalar(value);
      continue;
    }

    const values: string[] = [];
    while (lines[index + 1]?.startsWith("  - ")) {
      index += 1;
      values.push(unquoteYamlScalar(lines[index].slice(4)));
    }
    metadata[key] = values;
  }

  return { metadata, body: content.slice(end + "\n---\n".length) };
}

function serializeFrontmatter(metadata: Record<string, string | string[]>): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${escapeYamlScalar(item)}`);
      }
    } else {
      lines.push(`${key}: ${escapeYamlScalar(value)}`);
    }
  }

  lines.push("---", "");
  return lines.join("\n");
}

function escapeYamlScalar(value: string): string {
  if (!value || /\s|[:#\-[\]{},&*!|>'"%@`\n\r]/.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function scalarValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function arrayValue(value: string | string[] | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return cleanTags(Array.isArray(value) ? value : [value]);
}

function cleanTags(tags: string[] | undefined): string[] | undefined {
  const cleaned = tags?.map((tag) => tag.trim()).filter(Boolean);
  return cleaned?.length ? cleaned : undefined;
}

function titleFromHeading(content: string): string | undefined {
  const headings = [...content.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)];
  const h1 = headings.find((heading) => heading[0].startsWith("# "));
  return (h1 ?? headings[0])?.[1]?.trim();
}

function titleFromFilePath(filePath: string): string {
  const filename = filePath.split("/").pop() || "hackmd-note";
  return filename.replace(/\.md$/i, "") || "hackmd-note";
}
