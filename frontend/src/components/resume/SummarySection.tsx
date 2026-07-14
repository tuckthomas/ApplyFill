import { useState } from 'react';
import RichTextEditor from './RichTextEditor';

const getPlainText = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

type SummarySectionProps = {
  summary: string;
  onChange: (value: string) => void;
};

export default function SummarySection({ summary, onChange }: SummarySectionProps) {
  const [isEnhancingSummary, setIsEnhancingSummary] = useState(false);
  const [rewriteMessage, setRewriteMessage] = useState('');

  const handleAiEnhance = async () => {
    if (!getPlainText(summary)) {
      setRewriteMessage('Add a professional summary before rewriting.');
      return;
    }

    setIsEnhancingSummary(true);
    setRewriteMessage('');

    try {
      const response = await fetch('http://localhost:5033/api/ai/suggest-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSummary: summary,
          profileData: ''
        })
      });

      if (response.status === 503) {
        setRewriteMessage('AI rewrite is not configured yet.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to rewrite summary');
      }

      const data = await response.json();
      onChange(data.suggestedSummary);
      setRewriteMessage('Professional summary rewritten.');
    } catch (error) {
      console.error(error);
      setRewriteMessage('Rewrite failed. Try again after the API is available.');
    } finally {
      setIsEnhancingSummary(false);
    }
  };

  return (
    <div className="page-stack">
      <div>
        <h3 className="section-title">Professional Summary</h3>
        <p className="section-copy">
          Write a brief 2-4 sentence summary highlighting your most valuable skills and career achievements.
        </p>
      </div>
      
      <RichTextEditor
        aiLabel="Rewrite professional summary with AI"
        isAiEnhancing={isEnhancingSummary}
        label="Summary"
        labelId="professional-summary-label"
        onAiEnhance={handleAiEnhance}
        onChange={onChange}
        placeholder="e.g. Results-driven Software Engineer with 5+ years of experience building scalable web applications..."
        quillClassName="rich-text-quill-summary"
        toolbarId="professional-summary-toolbar"
        value={summary}
      />

      {rewriteMessage ? (
        <p className="section-copy" role="status">
          {rewriteMessage}
        </p>
      ) : null}
    </div>
  );
}
