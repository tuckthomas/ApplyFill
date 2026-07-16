import { createContext, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type TabbedFormTab = {
  disabled?: boolean;
  disabledReason?: string;
  id: string;
  label: string;
};

type TabTransitionContextValue = {
  activeTab: string;
  panelId: string;
  tabId: string;
};

const TabTransitionContext = createContext<TabTransitionContextValue | null>(null);

type TabTransitionProviderProps = {
  activeTab: string;
  children: (context: TabTransitionContextValue) => ReactNode;
  idPrefix: string;
};

export function TabTransitionProvider({ activeTab, children, idPrefix }: TabTransitionProviderProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const [transitionHeight, setTransitionHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const region = regionRef.current;
    if (!panel || !region) return;

    const nextHeight = panel.getBoundingClientRect().height;
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    const currentHeight = region.getBoundingClientRect().height;
    if (Math.abs(nextHeight - currentHeight) < 1) return;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (timerRef.current) window.clearTimeout(timerRef.current);

    setTransitionHeight(currentHeight);
    frameRef.current = requestAnimationFrame(() => setTransitionHeight(nextHeight));
    timerRef.current = window.setTimeout(() => setTransitionHeight(null), 220);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [activeTab]);

  const context = {
    activeTab,
    panelId: `${idPrefix}-${activeTab}-panel`,
    tabId: `${idPrefix}-${activeTab}-tab`
  };
  const regionStyle = transitionHeight === null ? undefined : ({ height: transitionHeight } satisfies CSSProperties);

  return (
    <TabTransitionContext.Provider value={context}>
      <div ref={regionRef} className="tabbed-form__transition-region" style={regionStyle}>
        <div ref={panelRef} className="tabbed-form__transition-panel">
          {children(context)}
        </div>
      </div>
    </TabTransitionContext.Provider>
  );
}

type TabbedFormProps = {
  activeTab: string;
  ariaLabel: string;
  children: (context: TabTransitionContextValue) => ReactNode;
  footer?: ReactNode;
  onTabChange: (tabId: string) => void;
  tabs: TabbedFormTab[];
};

export default function TabbedForm({ activeTab, ariaLabel, children, footer, onTabChange, tabs }: TabbedFormProps) {
  const idPrefix = useId().replace(/:/g, '');

  return (
    <div className="tabbed-form">
      <div className="tabbed-form__tabs" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const button = (
            <button
              id={`${idPrefix}-${tab.id}-tab`}
              className={`tabbed-form__tab${activeTab === tab.id ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-controls={`${idPrefix}-${tab.id}-panel`}
              aria-selected={activeTab === tab.id}
              disabled={tab.disabled}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );

          return tab.disabledReason ? (
            <span key={tab.id} className="tabbed-form__disabled-tooltip" data-tooltip={tab.disabledReason} tabIndex={0}>
              {button}
            </span>
          ) : <span key={tab.id}>{button}</span>;
        })}
      </div>

      <div className="tabbed-form__content">
        <TabTransitionProvider activeTab={activeTab} idPrefix={idPrefix}>
          {children}
        </TabTransitionProvider>
        {footer}
      </div>
    </div>
  );
}
