import RichTextEditor from '../../resume/RichTextEditor';

type TextWidgetProps = {
  id: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  value: string;
};

export default function TextWidget({ id, isEditing, onChange, value }: TextWidgetProps) {
  return (
    <div className={`dashboard-text-widget${isEditing ? ' is-editing' : ''}`}>
      <RichTextEditor
        hideLabel
        label="Widget text"
        labelId={`${id}-text-label`}
        onChange={onChange}
        placeholder="Enter text"
        quillClassName="dashboard-text-widget-quill"
        readOnly={!isEditing}
        toolbarId={`${id}-text-toolbar`}
        toolbarVariant={isEditing ? 'basic' : 'hidden'}
        value={value}
      />
    </div>
  );
}
