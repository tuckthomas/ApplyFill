import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Loader2, RemoveFormatting, Underline, Wand2 } from 'lucide-react';
import { getRichTextDocument, richTextExtensions, serializeRichText } from '../../features/rich-text/richText';

type RichTextEditorProps = {
  aiLabel?: string; disabled?: boolean; hideLabel?: boolean; isAiEnhancing?: boolean; label: string;
  labelAction?: ReactNode; labelId: string; onAiEnhance?: () => void; onChange: (value: string) => void;
  placeholder: string; editorClassName?: string; readOnly?: boolean; toolbarId: string;
  toolbarVariant?: 'standard' | 'basic' | 'hidden'; value: string;
};

export default function RichTextEditor({
  aiLabel = 'Rewrite with AI', disabled = false, hideLabel = false, isAiEnhancing = false, label,
  labelAction, labelId, onAiEnhance, onChange, placeholder, editorClassName = '', readOnly = false,
  toolbarId, toolbarVariant = 'standard', value
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: getRichTextDocument(value),
    editable: !disabled && !readOnly,
    editorProps: { attributes: { 'aria-labelledby': labelId, class: 'rich-text-editor-content' } },
    onUpdate: ({ editor: nextEditor }) => onChange(serializeRichText(nextEditor.getJSON()))
  });
  const [, setEditorRevision] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const refreshToolbar = () => setEditorRevision((revision) => revision + 1);
    editor.on('transaction', refreshToolbar);
    editor.on('selectionUpdate', refreshToolbar);
    return () => {
      editor.off('transaction', refreshToolbar);
      editor.off('selectionUpdate', refreshToolbar);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const next = serializeRichText(value);
    if (serializeRichText(editor.getJSON()) !== next) editor.commands.setContent(getRichTextDocument(next), { emitUpdate: false });
  }, [editor, value]);

  const keepSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
  const button = (label: string, active: boolean, action: () => void, icon: ReactNode) => (
    <button className={`rich-text-toolbar-button${active ? ' rich-text-format-active' : ''}`} type="button" aria-label={label} aria-pressed={active}
      data-tooltip={label} disabled={disabled || !editor} onMouseDown={keepSelection} onClick={action}>{icon}</button>
  );
  const isAiButtonDisabled = disabled || isAiEnhancing || !onAiEnhance;

  return <div className="form-group" style={{ marginBottom: '8px' }}>
    <div className="rich-text-label-row"><label id={labelId} className={hideLabel ? 'form-label sr-only' : 'form-label'}>{label}</label>{labelAction}</div>
    <div role="group" aria-labelledby={labelId} aria-disabled={disabled || undefined} aria-readonly={readOnly || undefined} className={`${disabled ? 'rich-text-disabled ' : ''}rich-text-shell`}>
      {toolbarVariant !== 'hidden' && <div className="rich-text-toolbar" id={toolbarId}>
        {button('Bold', editor?.isActive('bold') ?? false, () => editor?.chain().focus().toggleBold().run(), <Bold aria-hidden="true" />)}
        {button('Italic', editor?.isActive('italic') ?? false, () => editor?.chain().focus().toggleItalic().run(), <Italic aria-hidden="true" />)}
        {toolbarVariant === 'standard' && <>
          {button('Underline', editor?.isActive('underline') ?? false, () => editor?.chain().focus().toggleUnderline().run(), <Underline aria-hidden="true" />)}
          {button('Numbered list', editor?.isActive('orderedList') ?? false, () => editor?.chain().focus().toggleOrderedList().run(), <ListOrdered aria-hidden="true" />)}
          {button('Bulleted list', editor?.isActive('bulletList') ?? false, () => editor?.chain().focus().toggleBulletList().run(), <List aria-hidden="true" />)}
        </>}
        <button className="rich-text-toolbar-button" type="button" aria-label="Clear formatting" data-tooltip="Clear formatting" disabled={disabled || !editor} onMouseDown={keepSelection} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting aria-hidden="true" /></button>
        {toolbarVariant === 'standard' && onAiEnhance ? <button className="rich-text-ai-toolbar-button" type="button" onMouseDown={keepSelection} onClick={onAiEnhance} disabled={isAiButtonDisabled} aria-label={aiLabel} data-tooltip={aiLabel}>{isAiEnhancing ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}</button> : null}
      </div>}
      <EditorContent editor={editor} className={`rich-text-tiptap ${editorClassName}`.trim()} />
      {editor?.isEmpty && <span className="rich-text-placeholder">{placeholder}</span>}
    </div>
  </div>;
}
