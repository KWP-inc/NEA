/** The only activity names the site records. Add a name here before tracking anything new. */
export const EVENT_NAMES = [
  "page_view",
  "scan_start",
  "scan_finish",
  "lens_upload",
  "lens_result",
  "si_open",
  "si_question",
  "book_click",
  "signup_start",
  "signup_finish",
  "signin",
  "join_prompt_view",
  "join_prompt_click",
  "points_earned",
  "reward_redeemed",
  "lead_submit",
  "finder_finish",
  "outbound_click",
  "search",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
