import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "grantpilot",
  name: "GrantPilot AI",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
