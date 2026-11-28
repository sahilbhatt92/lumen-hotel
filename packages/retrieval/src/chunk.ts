export interface Chunk {
  id: string;
  documentId: string;
  title: string;
  heading: string;
  text: string;
}

export function chunkMarkdown(documentId: string, markdown: string): Chunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = documentId;
  const chunks: Chunk[] = [];
  let heading = "Overview";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    chunks.push({
      id: `${documentId}#${slug(heading)}`,
      documentId,
      title,
      heading,
      text,
    });
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      heading = line.slice(3).trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return chunks;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}
