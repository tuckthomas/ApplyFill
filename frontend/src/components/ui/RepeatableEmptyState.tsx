type RepeatableEmptyStateProps = {
  className?: string;
  title: string;
};

export default function RepeatableEmptyState({ className = '', title }: RepeatableEmptyStateProps) {
  const classes = ['field-card', 'repeatable-empty-state', className].filter(Boolean).join(' ');

  return (
    <section className={classes} aria-label={title}>
      <h4 className="section-title">{title}</h4>
    </section>
  );
}
