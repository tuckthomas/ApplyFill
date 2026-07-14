import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Loader2, Wand2 } from 'lucide-react';

const createModules = (toolbarId: string) => ({
  toolbar: {
    container: `#${toolbarId}`
  }
});

type RichTextEditorProps = {
  aiLabel?: string;
  disabled?: boolean;
  isAiEnhancing?: boolean;
  label: string;
  labelId: string;
  onAiEnhance?: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  quillClassName?: string;
  toolbarId: string;
  value: string;
};

export default function RichTextEditor({
  aiLabel = 'Rewrite with AI',
  disabled = false,
  isAiEnhancing = false,
  label,
  labelId,
  onAiEnhance,
  onChange,
  placeholder,
  quillClassName = '',
  toolbarId,
  value
}: RichTextEditorProps) {
  const isAiButtonDisabled = disabled || isAiEnhancing || !onAiEnhance;

  return (
    <div className="form-group" style={{ marginBottom: '8px' }}>
      <label id={labelId} className="form-label">
        {label}
      </label>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        className={disabled ? 'rich-text-disabled rich-text-shell' : 'rich-text-shell'}
      >
        <div className="rich-text-toolbar" id={toolbarId}>
          <button className="ql-bold" type="button" aria-label="Bold" data-tooltip="Bold" disabled={disabled} />
          <button className="ql-italic" type="button" aria-label="Italic" data-tooltip="Italic" disabled={disabled} />
          <button className="ql-underline" type="button" aria-label="Underline" data-tooltip="Underline" disabled={disabled} />
          <button className="ql-list" type="button" value="ordered" aria-label="Numbered list" data-tooltip="Numbered list" disabled={disabled} />
          <button className="ql-list" type="button" value="bullet" aria-label="Bulleted list" data-tooltip="Bulleted list" disabled={disabled} />
          <button className="ql-clean" type="button" aria-label="Clear formatting" data-tooltip="Clear formatting" disabled={disabled} />
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
        </div>
        <ReactQuill
          theme="snow"
          className={`rich-text-quill ${quillClassName}`.trim()}
          value={value}
          onChange={onChange}
          modules={createModules(toolbarId)}
          placeholder={placeholder}
          readOnly={disabled}
        />
      </div>
    </div>
  );
}
