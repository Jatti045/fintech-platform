import React from "react";
import MonthlyOverview, { type MonthlyOverviewProps } from "./MonthlyOverview";

export type HomePulseProps = MonthlyOverviewProps;

/**
 * HomePulse is now an alias for the redesigned MonthlyOverview component.
 */
const HomePulse = React.memo(function HomePulse(props: HomePulseProps) {
  return <MonthlyOverview {...props} />;
});

export default HomePulse;
