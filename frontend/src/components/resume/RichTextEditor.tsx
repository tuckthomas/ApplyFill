import { type MouseEvent, type ReactNode, useRef, useState } from 'react';
import ReactQuill, { type RangeStatic } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Loader2,
  RemoveFormatting,
  Underline,
  Wand2
} from 'lucide-react';

const NO_TOOLBAR_MODULES = {
  toolbar: false
};

type RichTextEditorProps = {
  aiLabel?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  isAiEnhancing?: boolean;
  label: string;
  labelAction?: ReactNode;
  labelId: string;
  onAiEnhance?: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  quillClassName?: string;
  readOnly?: boolean;
  toolbarId: string;
  toolbarVariant?: 'standard' | 'basic' | 'hidden';
  value: string;
};

type RichTextFormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  orderedList: boolean;
  bulletedList: boolean;
};

type ToggleableFormat = 'bold' | 'italic' | 'underline' | 'orderedList' | 'bulletedList';

const EMPTY_FORMAT_STATE: RichTextFormatState = {
  bold: false,
  italic: false,
  underline: false,
  orderedList: false,
  bulletedList: false
};

export default function RichTextEditor({
  aiLabel = 'Rewrite with AI',
  disabled = false,
  hideLabel = false,
  isAiEnhancing = false,
  label,
  labelAction,
  labelId,
  onAiEnhance,
  onChange,
  placeholder,
  quillClassName = '',
  readOnly = false,
  toolbarId,
  toolbarVariant = 'standard',
  value
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const lastSelectionRef = useRef<RangeStatic | null>(null);
  const [activeFormats, setActiveFormats] = useState<RichTextFormatState>(EMPTY_FORMAT_STATE);
  const isAiButtonDisabled = disabled || isAiEnhancing || !onAiEnhance;

  const updateFormatState = (selection: RangeStatic | null) => {
    if (!selection) return;

    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const formats = editor.getFormat(selection);
    setActiveFormats({
      bold: formats.bold === true,
      italic: formats.italic === true,
      underline: formats.underline === true,
      orderedList: formats.list === 'ordered',
      bulletedList: formats.list === 'bullet'
    });
  };

  const rememberSelection = (selection: RangeStatic | null) => {
    if (selection) {
      lastSelectionRef.current = selection;
      updateFormatState(selection);
    }
  };

  const preserveEditorSelection = () => {
    const editor = quillRef.current?.getEditor();
    const selection = lastSelectionRef.current;
    if (editor && selection) {
      editor.setSelection(selection, 'silent');
    }
  };

  const refreshFormatState = () => {
    window.setTimeout(() => {
      const editor = quillRef.current?.getEditor();
      const selection = editor?.getSelection() ?? lastSelectionRef.current;
      updateFormatState(selection ?? null);
    }, 0);
  };

  const handleToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    preserveEditorSelection();
  };

  const toggleFormat = (format: ToggleableFormat) => {
    const editor = quillRef.current?.getEditor();
    const selection = editor?.getSelection() ?? lastSelectionRef.current;
    if (!editor || !selection) return;

    lastSelectionRef.current = selection;
    editor.setSelection(selection, 'silent');

    if (format === 'orderedList' || format === 'bulletedList') {
      const listValue = format === 'orderedList' ? 'ordered' : 'bullet';
      const currentListValue = editor.getFormat(selection).list;
      editor.formatLine(
        selection.index,
        selection.length,
        'list',
        currentListValue === listValue ? false : listValue,
        'user'
      );
    } else {
      const isActive = editor.getFormat(selection)[format] === true;
      editor.format(format, !isActive, 'user');
    }

    refreshFormatState();
  };

  const handleEditorChange = (nextValue: string) => {
    onChange(nextValue);
    refreshFormatState();
  };

  const clearFormatting = () => {
    const editor = quillRef.current?.getEditor();
    const selection = editor?.getSelection() ?? lastSelectionRef.current;
    if (!editor || !selection) return;

    editor.setSelection(selection, 'silent');
    editor.removeFormat(selection.index, selection.length, 'user');
    refreshFormatState();
  };

  const formatButtonClass = (format: keyof RichTextFormatState, quillClass: string) => (
    `${quillClass} ${activeFormats[format] ? 'rich-text-format-active' : ''}`
  );

  return (
    <div className="form-group" style={{ marginBottom: '8px' }}>
      <div className="rich-text-label-row">
        <label id={labelId} className={hideLabel ? 'form-label sr-only' : 'form-label'}>{label}</label>
        {labelAction}
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        aria-readonly={readOnly || undefined}
        className={disabled ? 'rich-text-disabled rich-text-shell' : 'rich-text-shell'}
      >
        {toolbarVariant !== 'hidden' ? <div className="rich-text-toolbar" id={toolbarId}>
          <button className={formatButtonClass('bold', 'ql-bold')} type="button" aria-label="Bold" aria-pressed={activeFormats.bold} data-tooltip="Bold" data-format-active={activeFormats.bold} disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={() => toggleFormat('bold')}>
            <Bold aria-hidden="true" />
          </button>
          <button className={formatButtonClass('italic', 'ql-italic')} type="button" aria-label="Italic" aria-pressed={activeFormats.italic} data-tooltip="Italic" data-format-active={activeFormats.italic} disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={() => toggleFormat('italic')}>
            <Italic aria-hidden="true" />
          </button>
          {toolbarVariant === 'standard' ? (
            <>
              <button className={formatButtonClass('underline', 'ql-underline')} type="button" aria-label="Underline" aria-pressed={activeFormats.underline} data-tooltip="Underline" data-format-active={activeFormats.underline} disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={() => toggleFormat('underline')}>
                <Underline aria-hidden="true" />
              </button>
              <button className={formatButtonClass('orderedList', 'ql-list')} type="button" value="ordered" aria-label="Numbered list" aria-pressed={activeFormats.orderedList} data-tooltip="Numbered list" data-format-active={activeFormats.orderedList} disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={() => toggleFormat('orderedList')}>
                <ListOrdered aria-hidden="true" />
              </button>
              <button className={formatButtonClass('bulletedList', 'ql-list')} type="button" value="bullet" aria-label="Bulleted list" aria-pressed={activeFormats.bulletedList} data-tooltip="Bulleted list" data-format-active={activeFormats.bulletedList} disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={() => toggleFormat('bulletedList')}>
                <List aria-hidden="true" />
              </button>
            </>
          ) : null}
          <button className="ql-clean" type="button" aria-label="Clear formatting" data-tooltip="Clear formatting" disabled={disabled} onMouseDown={handleToolbarMouseDown} onClick={clearFormatting}>
            <RemoveFormatting aria-hidden="true" />
          </button>
          {toolbarVariant === 'standard' ? (
            <button
              className="rich-text-ai-toolbar-button"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onAiEnhance}
              disabled={isAiButtonDisabled}
              aria-label={aiLabel}
              data-tooltip={aiLabel}
            >
              {isAiEnhancing ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            </button>
          ) : null}
        </div> : null}
        <ReactQuill
          ref={quillRef}
          theme="snow"
          className={`rich-text-quill ${quillClassName}`.trim()}
          value={value}
          onChange={handleEditorChange}
          modules={NO_TOOLBAR_MODULES}
          placeholder={placeholder}
          readOnly={disabled || readOnly}
          onChangeSelection={rememberSelection}
          onFocus={rememberSelection}
        />
      </div>
    </div>
  );
}
