import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { ListChecks } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { isSafeHref } from '../../utils/documentContent';
import { DocumentBubbleMenu } from './DocumentBubbleMenu';
import { DocumentTaskComposer } from './DocumentTaskComposer';
import { TaskReference } from './taskReferenceNode';
import type { DocumentNode } from '../../contracts/document';

interface DocumentEditorProps {
  /** Replaces the editor content whenever it changes. */
  version: number;
  content: DocumentNode | null;
  readOnly: boolean;
  labelledBy: string;
  onEdit: (content: DocumentNode) => void;
  /** Creates a real child task for a new block and resolves to its id. */
  onCreateTask: (title: string) => Promise<string>;
}

/** StarterKit narrowed to the server allowlist: no underline, headings 1-3, http/https/mailto links. */
export function DocumentEditor({ version, content, readOnly, labelledBy, onEdit, onCreateTask }: DocumentEditorProps) {
  const { t } = useI18n();
  const onEditRef = useRef(onEdit);
  const composeRef = useRef<() => void>(() => {});
  const [composeAt, setComposeAt] = useState<number | null>(null);
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
      TaskReference,
    ],
    content: content ?? undefined,
    editable: !readOnly,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'detail-prose', 'aria-labelledby': labelledBy, 'aria-multiline': 'true', role: 'textbox' },
      handleKeyDown: (_view, event) => {
        if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 't') return false;
        event.preventDefault();
        composeRef.current();
        return true;
      },
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

  // The block goes after the paragraph or list the caret is in, never inside it.
  const openComposer = () => {
    if (!editor || readOnly) return;
    const { $to } = editor.state.selection;
    setComposeAt($to.depth >= 1 ? $to.after(1) : editor.state.doc.content.size);
  };
  composeRef.current = openComposer;

  // The caret lands in a paragraph after the block: left on the block itself, the next keystroke would replace it.
  const insertBlock = (taskId: string) => {
    setComposeAt(null);
    if (!editor) return;
    const at = Math.min(composeAt ?? 0, editor.state.doc.content.size);
    const block = { type: 'taskReference', attrs: { taskId, blockId: globalThis.crypto.randomUUID() } };
    const next = editor.state.doc.resolve(at).nodeAfter;
    const reuse = next?.type.name === 'paragraph' && next.content.size === 0;
    editor
      .chain()
      .insertContentAt(at, reuse ? block : [block, { type: 'paragraph' }])
      .setTextSelection(at + 2)
      .run();
    // Synchronous: Tiptap's focus() waits a frame, and keys typed meanwhile would land on the page.
    editor.view.focus();
  };

  return (
    <div className="detail-editor">
      {editor && !readOnly && <DocumentBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
      {composeAt !== null && <DocumentTaskComposer onCreate={onCreateTask} onInserted={insertBlock} onCancel={() => { setComposeAt(null); editor?.commands.focus(); }} />}
      {editor && !readOnly && composeAt === null && (
        <button type="button" className="detail-text-button detail-add-task" aria-keyshortcuts="Control+Shift+T Meta+Shift+T" onClick={openComposer}>
          <ListChecks size={14} aria-hidden="true" />
          {t('detail.addTask')}
        </button>
      )}
    </div>
  );
}
