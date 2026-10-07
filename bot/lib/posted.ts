import { createHash } from "node:crypto";

export function postedKey(link: string): string {
  const hash = createHash("sha256").update(link).digest("hex").slice(0, 24);
  return `posted:${hash}`;
}

export type PostedRecord = {
  link: string;
  title: string;
  postedAt: string;
  messageId?: number;
};
