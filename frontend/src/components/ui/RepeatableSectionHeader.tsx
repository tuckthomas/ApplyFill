import AddButton from './AddButton';

type RepeatableSectionHeaderProps = {
  actionLabel: string;
  className?: string;
  description?: string;
  headingLevel?: 3 | 4;
  onAdd: () => void;
  title: string;
};

export default function RepeatableSectionHeader({
  actionLabel,
  className = '',
  description,
  headingLevel = 3,
  onAdd,
  title
}: RepeatableSectionHeaderProps) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const classes = ['repeatable-section-header', className].filter(Boolean).join(' ');

  return (
    <header className={classes}>
      <div>
        <Heading className="section-title">{title}</Heading>
        {description ? <p className="section-copy">{description}</p> : null}
      </div>
      <AddButton onClick={onAdd}>{actionLabel}</AddButton>
    </header>
  );
}
