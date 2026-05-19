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
}

export function renderMarkdownForGitHubSync(input: RenderMarkdownInput): string {
  if (!input.includeTitleTags) {
    return input.content;
  }

  const parsed = parseFrontmatter(input.content);
  const metadata = {
    ...parsed.metadata,
    ...(input.title ? { title: input.title } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
  };

  return `${serializeFrontmatter(metadata)}${parsed.body.startsWith("\n") ? parsed.body : `\n${parsed.body}`}`;
}

export function parseMarkdownForHackMdImport(input: ParseMarkdownForHackMdImportInput): ParsedMarkdownForHackMdImport {
  const parsed = parseFrontmatter(input.content);
  const title = scalarValue(parsed.metadata.title) ?? titleFromFilePath(input.filePath);
  const tags = arrayValue(parsed.metadata.tags);

  return {
    content: parsed.body.replace(/^\n/, ""),
    title,
    tags,
    hadTitleTagsFrontmatter: Boolean(parsed.metadata.title || parsed.metadata.tags),
  };
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
      metadata[key] = value;
      continue;
    }

    const values: string[] = [];
    while (lines[index + 1]?.startsWith("  - ")) {
      index += 1;
      values.push(lines[index].slice(4));
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
  if (!value || /[:#\-[\]{},&*!|>'"%@`\n\r]/.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

function scalarValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function arrayValue(value: string | string[] | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function titleFromFilePath(filePath: string): string {
  const filename = filePath.split("/").pop() || "hackmd-note";
  return filename.replace(/\.md$/i, "") || "hackmd-note";
}
