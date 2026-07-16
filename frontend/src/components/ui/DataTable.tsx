import { useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, MoreVertical, Search, X } from 'lucide-react';
import type { StylesConfig } from 'react-select';
import { selectStyles } from '../../constants/location';
import AppSelect from './AppSelect';
import Button from './Button';
import Checkbox from './Checkbox';

type SortDirection = 'asc' | 'desc';
type SortValue = Date | number | string | null | undefined;

export type DataTableColumn<Row> = {
  cell: (row: Row) => ReactNode;
  className?: string;
  header: ReactNode;
  hideOnMobile?: boolean;
  id: string;
  searchValue?: (row: Row) => string;
  sortValue?: (row: Row) => SortValue;
};

type DataTableTextFilter<Row> = {
  getValue: (row: Row) => string;
  id: string;
  label: string;
  placeholder?: string;
  type: 'text';
};

type DataTableOptionsFilter<Row> = {
  getValue: (row: Row) => string;
  id: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  type: 'options';
};

export type DataTableFilter<Row> = DataTableOptionsFilter<Row> | DataTableTextFilter<Row>;

type DataTableProps<Row> = {
  caption: string;
  columns: Array<DataTableColumn<Row>>;
  description?: ReactNode;
  emptyContent?: ReactNode;
  filters?: Array<DataTableFilter<Row>>;
  getRowId: (row: Row) => string;
  initialSort?: { columnId: string; direction: SortDirection };
  noResultsContent?: ReactNode;
  rows: Row[];
  searchPlaceholder?: string;
  title: ReactNode;
  toolbarAction?: ReactNode;
};

const COLUMN_MENU_WIDTH = 280;
type ColumnMenuOption = { label: string; value: string };

const COLUMN_MENU_OPTIONS: ColumnMenuOption[] = [{ label: 'Column options', value: 'column-options' }];

const columnMenuSelectStyles: StylesConfig<ColumnMenuOption, false> = {
  control: (base, state) => ({
    ...base,
    background: state.menuIsOpen ? 'var(--primary-glow)' : 'transparent',
    border: 0,
    borderRadius: 'var(--border-radius-sm)',
    boxShadow: 'none',
    cursor: 'pointer',
    height: 32,
    minHeight: 32,
    width: 32,
    '&:hover': {
      background: 'var(--primary-glow)'
    }
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.selectProps.menuIsOpen ? 'var(--primary-color)' : 'var(--text-soft)',
    padding: 0
  }),
  indicatorsContainer: (base) => ({
    ...base,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32
  }),
  menu: (base) => ({
    ...selectStyles.menu(base),
    width: COLUMN_MENU_WIDTH
  }),
  menuPortal: (base, state) => ({
    ...base,
    left: Math.min(
      state.rect.left,
      Math.max(12, window.innerWidth - COLUMN_MENU_WIDTH - 12)
    ),
    width: COLUMN_MENU_WIDTH
  }),
  valueContainer: (base) => ({
    ...base,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    width: 1
  })
};

const compareValues = (left: SortValue, right: SortValue) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  const normalizedLeft = left instanceof Date ? left.getTime() : left;
  const normalizedRight = right instanceof Date ? right.getTime() : right;

  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

export default function DataTable<Row>({
  caption,
  columns,
  description,
  emptyContent,
  filters = [],
  getRowId,
  initialSort,
  noResultsContent,
  rows,
  searchPlaceholder = 'Search records',
  title,
  toolbarAction
}: DataTableProps<Row>) {
  const generatedId = useId().replace(/:/g, '');
  const titleId = `data-table-title-${generatedId}`;
  const retainMenuOpenRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [optionFilters, setOptionFilters] = useState<Record<string, string[]>>({});
  const [textFilters, setTextFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort);
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const filterById = useMemo(() => new Map(filters.map((filter) => [filter.id, filter])), [filters]);

  const visibleRows = useMemo(() => {
    const filteredRows = rows.filter((row) => {
      const matchesSearch = !normalizedQuery || columns.some((column) => (
        column.searchValue?.(row).toLocaleLowerCase().includes(normalizedQuery)
      ));
      if (!matchesSearch) return false;

      return filters.every((filter) => {
        if (filter.type === 'text') {
          const filterValue = textFilters[filter.id]?.trim().toLocaleLowerCase() ?? '';
          return !filterValue || filter.getValue(row).toLocaleLowerCase().includes(filterValue);
        }

        const selectedValues = optionFilters[filter.id] ?? [];
        return selectedValues.length === 0 || selectedValues.includes(filter.getValue(row));
      });
    });

    if (!sort) return filteredRows;
    const sortColumn = columns.find((column) => column.id === sort.columnId);
    if (!sortColumn?.sortValue) return filteredRows;

    return filteredRows
      .map((row, index) => ({ index, row }))
      .sort((left, right) => {
        const comparison = compareValues(sortColumn.sortValue?.(left.row), sortColumn.sortValue?.(right.row));
        if (comparison !== 0) return sort.direction === 'asc' ? comparison : -comparison;
        return left.index - right.index;
      })
      .map(({ row }) => row);
  }, [columns, filters, normalizedQuery, optionFilters, rows, sort, textFilters]);

  const toggleOptionFilter = (filterId: string, value: string) => {
    setOptionFilters((current) => {
      const selectedValues = current[filterId] ?? [];
      const nextValues = selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value];

      return { ...current, [filterId]: nextValues };
    });
  };

  const clearColumnFilter = (filter: DataTableFilter<Row>) => {
    if (filter.type === 'text') {
      setTextFilters((current) => ({ ...current, [filter.id]: '' }));
      return;
    }
    setOptionFilters((current) => ({ ...current, [filter.id]: [] }));
  };

  const isFilterActive = (filter: DataTableFilter<Row> | undefined) => {
    if (!filter) return false;
    return filter.type === 'text'
      ? Boolean(textFilters[filter.id]?.trim())
      : (optionFilters[filter.id]?.length ?? 0) > 0;
  };

  const hasActiveFilters = filters.some(isFilterActive);
  const hasActiveQuery = Boolean(normalizedQuery || hasActiveFilters);
  const getColumnClassName = (column: DataTableColumn<Row>) => [
    column.className,
    column.hideOnMobile ? 'data-table-column-mobile-hidden' : ''
  ].filter(Boolean).join(' ') || undefined;

  const renderColumnMenu = (column: DataTableColumn<Row>, filter: DataTableFilter<Row> | undefined) => (
    <div
      className="data-table-column-menu-content"
      onMouseDownCapture={() => { retainMenuOpenRef.current = true; }}
    >
        {column.sortValue && (
          <div className="data-table-column-menu-section">
            <span className="data-table-column-menu-label">Sort</span>
            <button
              className="data-table-column-menu-item"
              onClick={() => {
                setSort({ columnId: column.id, direction: 'asc' });
                setOpenColumnId(null);
              }}
              type="button"
            >
              <ArrowUp aria-hidden="true" size={17} />
              Sort ascending
              {sort?.columnId === column.id && sort.direction === 'asc' && <Check aria-hidden="true" className="data-table-column-menu-check" size={17} />}
            </button>
            <button
              className="data-table-column-menu-item"
              onClick={() => {
                setSort({ columnId: column.id, direction: 'desc' });
                setOpenColumnId(null);
              }}
              type="button"
            >
              <ArrowDown aria-hidden="true" size={17} />
              Sort descending
              {sort?.columnId === column.id && sort.direction === 'desc' && <Check aria-hidden="true" className="data-table-column-menu-check" size={17} />}
            </button>
            {sort?.columnId === column.id && (
              <button className="data-table-column-menu-clear" onClick={() => setSort(undefined)} type="button">Clear sorting</button>
            )}
          </div>
        )}

        {filter && (
          <div className="data-table-column-menu-section">
            <div className="data-table-column-menu-label-row">
              <span className="data-table-column-menu-label">Filter</span>
              {isFilterActive(filter) && (
                <button className="data-table-column-menu-clear" onClick={() => clearColumnFilter(filter)} type="button">Clear</button>
              )}
            </div>

            {filter.type === 'text' ? (
              <>
                <label className="sr-only" htmlFor={`column-filter-${generatedId}-${filter.id}`}>{filter.label}</label>
                <input
                  autoFocus
                  className="form-input data-table-column-filter-input"
                  id={`column-filter-${generatedId}-${filter.id}`}
                  onChange={(event) => setTextFilters((current) => ({ ...current, [filter.id]: event.target.value }))}
                  placeholder={filter.placeholder ?? `Filter ${filter.label.toLocaleLowerCase()}`}
                  type="search"
                  value={textFilters[filter.id] ?? ''}
                />
              </>
            ) : (
              <div className="data-table-column-filter-options">
                {filter.options.map((option) => (
                  <Checkbox
                    checked={(optionFilters[filter.id] ?? []).includes(option.value)}
                    key={option.value}
                    label={option.label}
                    onChange={() => toggleOptionFilter(filter.id, option.value)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );

  return (
    <div className="data-table" aria-labelledby={titleId}>
      <div className="toolbar-row data-table-header">
        <div className="data-table-heading">
          <h3 id={titleId} className="section-title">{title}</h3>
          {description && <p className="section-copy">{description}</p>}
        </div>

        <div className="data-table-controls">
          <div className="data-table-search">
            <Search aria-hidden="true" size={18} />
            <label className="sr-only" htmlFor={`data-table-search-${generatedId}`}>Search table</label>
            <input
              className="form-input"
              id={`data-table-search-${generatedId}`}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={searchQuery}
            />
          </div>
          {toolbarAction}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state data-table-empty-state">{emptyContent}</div>
      ) : visibleRows.length === 0 ? (
        <div className="empty-state data-table-empty-state">
          {noResultsContent}
          {hasActiveQuery && (
            <Button
              onClick={() => {
                setSearchQuery('');
                setOptionFilters({});
                setTextFilters({});
              }}
              variant="secondary"
            >
              <X aria-hidden="true" size={18} />
              Clear search and filters
            </Button>
          )}
        </div>
      ) : (
        <div className="data-table-scroll-region">
          <table>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => {
                  const columnFilter = filterById.get(column.id);
                  const hasColumnMenu = Boolean(column.sortValue || columnFilter);
                  const isSorted = sort?.columnId === column.id;
                  const isActive = isSorted || isFilterActive(columnFilter);
                  const ariaSort = column.sortValue
                    ? (isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none')
                    : undefined;

                  return (
                    <th aria-sort={ariaSort} className={getColumnClassName(column)} key={column.id} scope="col">
                      <div className="data-table-column-header">
                        <span>{column.header}</span>
                        {hasColumnMenu && (
                          <div
                            className="data-table-column-menu-trigger"
                            onMouseDownCapture={(event) => {
                              if (openColumnId !== column.id) return;
                              event.preventDefault();
                              event.stopPropagation();
                              retainMenuOpenRef.current = false;
                              setOpenColumnId(null);
                            }}
                          >
                            <AppSelect<ColumnMenuOption>
                              aria-label={`${String(column.header)} column options`}
                              className={`data-table-column-menu-select${isActive ? ' is-active' : ''}`}
                              closeMenuOnSelect={false}
                              components={{
                                DropdownIndicator: () => <MoreVertical aria-hidden="true" size={18} />,
                                IndicatorSeparator: null,
                                MenuList: () => renderColumnMenu(column, columnFilter)
                              }}
                              isSearchable={false}
                              menuIsOpen={openColumnId === column.id}
                              onChange={() => undefined}
                              onMenuClose={() => {
                                if (retainMenuOpenRef.current) {
                                  retainMenuOpenRef.current = false;
                                  return;
                                }
                                window.requestAnimationFrame(() => {
                                  const activeElement = document.activeElement;
                                  if (activeElement instanceof HTMLElement && activeElement.closest('.data-table-column-menu-content')) return;
                                  setOpenColumnId(null);
                                });
                              }}
                              onMenuOpen={() => setOpenColumnId(column.id)}
                              options={COLUMN_MENU_OPTIONS}
                              placeholder=""
                              styles={columnMenuSelectStyles}
                              value={null}
                            />
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={getRowId(row)}>
                  {columns.map((column) => (
                    <td className={getColumnClassName(column)} key={column.id}>{column.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
