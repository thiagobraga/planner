export type ChangelogInlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: ChangelogInlineNode[] }
  | { type: 'italic'; children: ChangelogInlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: ChangelogInlineNode[] };

export type ChangelogBlock =
  | { type: 'heading'; level: 3; children: ChangelogInlineNode[] }
  | { type: 'paragraph'; children: ChangelogInlineNode[] }
  | { type: 'list'; ordered: boolean; items: ChangelogInlineNode[][] };

export interface ChangelogSection {
  heading: ChangelogInlineNode[];
  blocks: ChangelogBlock[];
}

export interface ChangelogDocument {
  title: string | null;
  intro: ChangelogBlock[];
  sections: ChangelogSection[];
}
