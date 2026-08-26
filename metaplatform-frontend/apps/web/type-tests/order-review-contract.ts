import type {
  ActionProposal,
  ActionResult,
  HighValueUnpaidResponse,
} from '../src/api/superai/orderReview';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Value extends true> = Value;

export type ThresholdIsRequired = Assert<
  Equal<HighValueUnpaidResponse['threshold_cents'], number>
>;
export type ProposalActionIsLiteral = Assert<
  Equal<ActionProposal['action_type'], 'order_review_confirm'>
>;
export type ResultOrderVersionIsNullable = Assert<
  Equal<ActionResult['order_version'], number | null | undefined>
>;
export type ResultFollowUpTaskIsNullable = Assert<
  Equal<ActionResult['follow_up_task_id'], string | null | undefined>
>;
export type ResultReasonIsNullable = Assert<
  Equal<ActionResult['reason'], string | null | undefined>
>;
