import ReactSelect from 'react-select';
import type { GroupBase, Props, StylesConfig } from 'react-select';

import { selectStyles } from '../../constants/location';

export default function AppSelect<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
>(props: Props<Option, IsMulti, Group>) {
  const suppliedMenuPortalStyle = props.styles?.menuPortal;
  const styles = {
    ...selectStyles,
    ...props.styles,
    menuPortal: (base, state) => ({
      ...(suppliedMenuPortalStyle ? suppliedMenuPortalStyle(base, state) : base),
      zIndex: 1200
    })
  } as StylesConfig<Option, IsMulti, Group>;

  return (
    <ReactSelect
      {...props}
      menuPlacement={props.menuPlacement ?? 'auto'}
      menuPortalTarget={props.menuPortalTarget ?? (typeof document !== 'undefined' ? document.body : undefined)}
      menuPosition={props.menuPosition ?? 'fixed'}
      menuShouldScrollIntoView={props.menuShouldScrollIntoView ?? false}
      styles={styles}
    />
  );
}
