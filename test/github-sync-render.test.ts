import { describe, expect, it } from "vitest";

import { parseMarkdownForHackMdImport, renderMarkdownForGitHubSync } from "../src/github/markdown.js";

describe("renderMarkdownForGitHubSync", () => {
  it("returns raw content by default", () => {
    expect(
      renderMarkdownForGitHubSync({
        content: "# Body\n",
        title: "Plan",
        tags: ["docs"],
        includeTitleTags: false,
      }),
    ).toBe("# Body\n");
  });

  it("prepends title and tags frontmatter when requested", () => {
    expect(
      renderMarkdownForGitHubSync({
        content: "# Body\n",
        title: "Plan",
        tags: ["docs", "sync"],
        includeTitleTags: true,
      }),
    ).toBe("---\ntitle: Plan\ntags:\n  - docs\n  - sync\n---\n\n# Body\n");
  });

  it("merges title and tags into existing frontmatter", () => {
    expect(
      renderMarkdownForGitHubSync({
        content: "---\ndescription: Existing\n---\n\n# Body\n",
        title: "Plan",
        tags: ["docs"],
        includeTitleTags: true,
      }),
    ).toBe("---\ndescription: Existing\ntitle: Plan\ntags:\n  - docs\n---\n\n# Body\n");
  });
});

describe("parseMarkdownForHackMdImport", () => {
  it("extracts title and tags from frontmatter and strips it from the body", () => {
    expect(
      parseMarkdownForHackMdImport({
        content: "---\ntitle: Release Plan\ntags:\n  - docs\n  - sync\n---\n\n# Body\n",
        filePath: "docs/fallback.md",
      }),
    ).toEqual({
      content: "# Body\n",
      title: "Release Plan",
      tags: ["docs", "sync"],
      hadTitleTagsFrontmatter: true,
    });
  });

  it("derives a title from the filename when frontmatter has no title", () => {
    expect(
      parseMarkdownForHackMdImport({
        content: "# Body\n",
        filePath: "docs/release-plan.md",
      }),
    ).toEqual({
      content: "# Body\n",
      title: "release-plan",
      tags: undefined,
      hadTitleTagsFrontmatter: false,
    });
  });
});
