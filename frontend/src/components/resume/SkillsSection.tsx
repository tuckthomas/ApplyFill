import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Select from '../ui/AppSelect';
import { Plus, Trash2 } from 'lucide-react';
import { SKILL_SUGGESTIONS } from '../../constants/skillsTaxonomy';
import { selectStyles } from '../../constants/location';

export type SkillLevel = 'Novice' | 'Intermediate' | 'Advanced' | 'Expert';

export type SkillEntry = {
  id: number;
  name: string;
  level: SkillLevel | null;
};

type SkillLevelOption = {
  value: SkillLevel;
  label: SkillLevel;
};

const SKILL_LEVEL_OPTIONS: SkillLevelOption[] = ['Novice', 'Intermediate', 'Advanced', 'Expert'].map((level) => ({
  value: level as SkillLevel,
  label: level as SkillLevel
}));

const normalizeSkill = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const createSkill = (name: string): SkillEntry => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  name: name.trim().replace(/\s+/g, ' '),
  level: null
});

type SkillsSectionProps = {
  skills: SkillEntry[];
  onChange: Dispatch<SetStateAction<SkillEntry[]>>;
};

export default function SkillsSection({ skills, onChange }: SkillsSectionProps) {
  const [skillSearch, setSkillSearch] = useState('');
  const setSkills = onChange;

  const selectedSkillNames = useMemo(
    () => new Set(skills.map((skill) => normalizeSkill(skill.name))),
    [skills]
  );

  const matchingSkills = useMemo(() => {
    const query = normalizeSkill(skillSearch);

    if (query.length < 2) return [];

    return SKILL_SUGGESTIONS
      .filter((skill) => !selectedSkillNames.has(normalizeSkill(skill.label)))
      .map((skill) => {
        const normalizedLabel = normalizeSkill(skill.label);
        const startsWithQuery = normalizedLabel.startsWith(query);
        const containsQuery = normalizedLabel.includes(query);
        const wordStartsWithQuery = normalizedLabel.split(' ').some((word) => word.startsWith(query));

        return {
          ...skill,
          rank: startsWithQuery ? 0 : wordStartsWithQuery ? 1 : containsQuery ? 2 : 3
        };
      })
      .filter((skill) => skill.rank < 3)
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [selectedSkillNames, skillSearch]);

  const normalizedSkillSearch = normalizeSkill(skillSearch);
  const exactDatasetSkill = SKILL_SUGGESTIONS.find((skill) => (
    normalizeSkill(skill.label) === normalizedSkillSearch
  ));
  const canAddCustomSkill = normalizedSkillSearch.length > 0
    && !exactDatasetSkill
    && !selectedSkillNames.has(normalizedSkillSearch)
    && matchingSkills.length === 0;

  const addSkill = (name = skillSearch) => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');

    if (!trimmedName || selectedSkillNames.has(normalizeSkill(trimmedName))) return;

    setSkills((current) => [...current, createSkill(trimmedName)]);
    setSkillSearch('');
  };

  const updateSkillLevel = (id: number, level: SkillLevel) => {
    setSkills((current) => current.map((skill) => (
      skill.id === id ? { ...skill, level } : skill
    )));
  };

  const removeSkill = (id: number) => {
    setSkills((current) => current.filter((skill) => skill.id !== id));
  };

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <div>
          <h3 className="section-title">Skills</h3>
          <p className="section-copy">
            Add reusable skills in the same structured format commonly used by job applications.
          </p>
        </div>
      </div>

      <div className="skill-add-row">
        <div className="skill-search-field">
          <label className="form-label" htmlFor="skill-search">Skill</label>
          <div className="skill-search-input-wrap">
            <input
              id="skill-search"
              className="form-input skill-search-input"
              type="text"
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill(matchingSkills[0]?.label ?? skillSearch);
                }
              }}
              placeholder="Start typing a skill"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={matchingSkills.length > 0}
              aria-controls="skill-suggestions"
            />
            <button
              className="skill-inline-add-button"
              type="button"
              onClick={() => addSkill()}
              disabled={!canAddCustomSkill}
              aria-disabled={!canAddCustomSkill}
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          {matchingSkills.length > 0 && (
            <div className="skill-suggestion-list" id="skill-suggestions" role="listbox">
              {matchingSkills.map((skill) => (
                <button
                  className="skill-suggestion-option"
                  key={skill.id}
                  type="button"
                  role="option"
                  onClick={() => addSkill(skill.label)}
                >
                  {skill.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {skills.length === 0 ? (
        <section className="field-card job-empty-state" aria-label="No skills added">
          <h4 className="section-title">No skills added</h4>
        </section>
      ) : (
        <div className="skill-card-grid" aria-label="Selected skills">
          {skills.map((skill, index) => (
            <section className="skill-card" key={skill.id} aria-label={`${skill.name} skill`}>
              <div className="skill-card-header">
                <h4 className="skill-card-title">{skill.name}</h4>
                <button
                  className="icon-button icon-button-danger skill-remove-button"
                  type="button"
                  onClick={() => removeSkill(skill.id)}
                  aria-label={`Remove ${skill.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <label className="sr-only" htmlFor={`skill-level-${skill.id}`}>
                Skill Level
              </label>
              <Select
                inputId={`skill-level-${skill.id}`}
                options={SKILL_LEVEL_OPTIONS}
                placeholder="Select skill level"
                styles={selectStyles}
                value={SKILL_LEVEL_OPTIONS.find((option) => option.value === skill.level) ?? null}
                onChange={(option) => updateSkillLevel(skill.id, (option as SkillLevelOption).value)}
                aria-label={`${skill.name} skill level`}
              />

              <span className="sr-only">Skill {index + 1}</span>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
