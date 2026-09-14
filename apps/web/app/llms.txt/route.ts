import {
  FEATURES,
  PUBLIC_PAGES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  absoluteUrl,
} from "~/lib/seo";

/**
 * /llms.txt — a Markdown map of the site for language models, per the
 * convention at https://llmstxt.org.
 *
 * Generated from lib/seo.ts rather than kept as a static file in public/, so
 * it cannot drift out of step with the sitemap the way hand-maintained copy
 * does. Adoption of this convention is still thin and it is not a ranking
 * signal; it costs one route and stays correct on its own.
 */
export const dynamic = "force-static";

function body() {
  const links = PUBLIC_PAGES.filter((page) => page.path !== "/")
    .map((page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.summary}`)
    .join("\n");

  return `# ${SITE_NAME}

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

${SITE_NAME} is a web application for building forms, collecting responses, and reading
the results in the same place the form was built. It also includes Menti, a live
presentation mode where an audience answers from their phones.

## What it does

${FEATURES.map((feature) => `- ${feature}`).join("\n")}

## How a form works

1. Create a form from the dashboard and build it on a canvas or as an ordered outline.
2. Optionally split it into segments and add branching rules that route on the answers
   so far.
3. Publish it. A published form is reachable by link and open to anyone, unless the
   author requires sign-in, restricts it to specific email domains, or limits it to one
   response per person.
4. Read the responses from the form's own Responses tab: a summary, a per-question view,
   individual submissions, and CSV export.

## Pages

${links}

## Notes

- Respondents do not need an account unless the form's author requires one.
- A form's responses are visible to its owner and to collaborators the owner invites.
- Live form URLs under /forms/ are user data and are not indexed.
`;
}

export function GET() {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
