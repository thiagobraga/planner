import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { useI18n } from '../../i18n/I18nContext';
import { isSafeHref } from '../../utils/documentContent';
import { DocumentBubbleMenu } from './DocumentBubbleMenu';
import type { DocumentNode } from '../../contracts/document';

interface DocumentEditorProps {
  /** Replaces the editor content whenever it changes. */
  version: number;
  content: DocumentNode | null;
  readOnly: boolean;
  labelledBy: string;
  onEdit: (content: DocumentNode) => void;
}

/** StarterKit narrowed to the server allowlist: no underline, headings 1-3, http/https/mailto links. */
export function DocumentEditor({ version, content, readOnly, labelledBy, onEdit }: DocumentEditorProps) {
  const { t } = useI18n();
  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        // Appending a paragraph after a trailing list or quote would count as an edit and save on focus.
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          protocols: ['mailto'],
          isAllowedUri: (url) => isSafeHref(url),
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Placeholder.configure({ placeholder: t('detail.descriptionPlaceholder') }),
    ],
    content: content ?? undefined,
    editable: !readOnly,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'detail-prose', 'aria-labelledby': labelledBy, 'aria-multiline': 'true', role: 'textbox' },
    },
    onUpdate: ({ editor: current }) => onEditRef.current(current.getJSON() as DocumentNode),
  });

  const shown = useRef(version);
  useEffect(() => {
    if (!editor || shown.current === version) return;
    shown.current = version;
    editor.commands.setContent(content ?? '', { emitUpdate: false });
  }, [content, editor, version]);

  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  return (
    <div className="detail-editor">
      {editor && !readOnly && <DocumentBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
