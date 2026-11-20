import { useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Italic, Link2, List, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { isSafeHref } from '../../utils/documentContent';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** Formatting for the current selection; every action also has a keyboard shortcut or markdown input rule. */
export function DocumentBubbleMenu({ editor }: { editor: Editor }) {
  const { t } = useI18n();
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'), code: e.isActive('code'),
      link: e.isActive('link'), h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
    }),
  });
  const chain = () => editor.chain().focus();

  const button = (key: string, label: string, pressed: boolean, run: () => void, icon: ReactNode) => (
    <button key={key} type="button" className="detail-bubble-button" aria-label={label} title={label} aria-pressed={pressed} onClick={run}>
      {icon}
    </button>
  );

  const applyLink = () => {
    const value = href.trim();
    if (!value) chain().extendMarkRange('link').unsetLink().run();
    else if (isSafeHref(value)) chain().extendMarkRange('link').setLink({ href: value }).run();
    else return;
    setLinking(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      className="detail-bubble"
      role="toolbar"
      aria-label={t('detail.formatting')}
      options={{ onHide: () => setLinking(false) }}
    >
      {linking ? (
        <form className="detail-bubble-link" onSubmit={(event) => { event.preventDefault(); applyLink(); }}>
          <input
            autoFocus
            type="url"
            aria-label={t('detail.linkPrompt')}
            placeholder="https://"
            value={href}
            aria-invalid={href.trim() !== '' && !isSafeHref(href.trim())}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setLinking(false);
                editor.commands.focus();
              }
            }}
          />
        </form>
      ) : (
        <>
          {button('b', `${t('detail.bold')} (${MOD}B)`, active.bold, () => chain().toggleBold().run(), <Bold size={14} aria-hidden="true" />)}
          {button('i', `${t('detail.italic')} (${MOD}I)`, active.italic, () => chain().toggleItalic().run(), <Italic size={14} aria-hidden="true" />)}
          {button('s', `${t('detail.strike')} (${MOD}Shift+S)`, active.strike, () => chain().toggleStrike().run(), <Strikethrough size={14} aria-hidden="true" />)}
          {button('c', `${t('detail.code')} (${MOD}E)`, active.code, () => chain().toggleCode().run(), <Code size={14} aria-hidden="true" />)}
          {button('l', t('detail.link'), active.link, () => {
            setHref(String(editor.getAttributes('link').href ?? ''));
            setLinking(true);
          }, <Link2 size={14} aria-hidden="true" />)}
          <span className="detail-bubble-sep" aria-hidden="true" />
          {([1, 2, 3] as const).map((level) => button(`h${level}`, `${t('detail.heading', { level })} (${MOD}Alt+${level})`, active[`h${level}`], () => chain().toggleHeading({ level }).run(), <span className="detail-bubble-text" aria-hidden="true">H{level}</span>))}
          {button('ul', `${t('detail.bulletList')} (${MOD}Shift+8)`, active.bullet, () => chain().toggleBulletList().run(), <List size={14} aria-hidden="true" />)}
          {button('ol', `${t('detail.orderedList')} (${MOD}Shift+7)`, active.ordered, () => chain().toggleOrderedList().run(), <ListOrdered size={14} aria-hidden="true" />)}
          {button('q', `${t('detail.quote')} (${MOD}Shift+B)`, active.quote, () => chain().toggleBlockquote().run(), <Quote size={14} aria-hidden="true" />)}
        </>
      )}
    </BubbleMenu>
  );
}
