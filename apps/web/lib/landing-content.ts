/**
 * Landing-page copy that is read by both the page component and the FAQPage
 * structured data on the server.
 *
 * It lives here rather than in the landing component because that component is
 * a client module: importing a value out of a "use client" file from a server
 * component yields a client reference, not the value itself, so JSON.stringify
 * on the server sees an opaque proxy instead of an array.
 */

export const FIELD_TYPES = [
  "Short text",
  "Long text",
  "Email",
  "Phone",
  "URL",
  "Number",
  "Dropdown",
  "Checkboxes",
  "Rating",
  "Toggle",
  "Date",
  "Time",
  "File upload",
];

export const FAQS = [
  {
    q: "How is CanvasFlow different from Google Forms?",
    a: "You lay a form out on an open canvas, split it into segments, and branch on the answers so far — weighing several answers at once, not just the last one. Respondents get the layout you chose: one question at a time, one segment per page, or the whole form at once. And the results live inside the form you built, not in a separate export.",
  },
  {
    q: "Do my respondents need an account?",
    a: "Not unless you ask for one. A published form is open to anyone with the link. You can optionally require sign-in, record the respondent's email, allow one response per person, or accept only certain email domains.",
  },
  {
    q: "Which field types can I use?",
    a: `${FIELD_TYPES.slice(0, -1).join(", ")}, and ${FIELD_TYPES.at(-1)?.toLowerCase()}. Each field can be marked required, given a placeholder and help text, and dragged into any order. Email and URL fields are format-checked before a respondent can move on.`,
  },
  {
    q: "How do I stop collecting responses?",
    a: "Close the form with one toggle, or give it a closing date and it shuts itself. You can also unpublish it entirely, which puts it back into draft and takes the public link offline.",
  },
  {
    q: "Can I export my responses?",
    a: "Yes. Every submission lands in a table you can page through, and the whole set downloads as CSV whenever you like.",
  },
  {
    q: "Can my team help build a form?",
    a: "Invite teammates as collaborators with a viewer or editor role, change that role later, remove them, or transfer ownership outright. Roles are checked on the server for every request.",
  },
];
