import React from "react";
import RecentTransactions, {
  type RecentTransactionsProps,
} from "./RecentTransactions";

export type RecentFlowProps = RecentTransactionsProps;

/**
 * RecentFlow is now an alias for the redesigned RecentTransactions component.
 */
const RecentFlow = React.memo(function RecentFlow(props: RecentFlowProps) {
  return <RecentTransactions {...props} />;
});

export default RecentFlow;
