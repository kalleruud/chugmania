export type DocDescriptor = {
  slug: string
  title: string
  path: string
  summary?: string
}

export const docsManifest: DocDescriptor[] = [
  {
    slug: 'readme',
    title: 'Project Overview',
    path: 'README.md',
    summary: 'High-level overview, scripts, and setup instructions.',
  },
  {
    slug: 'agents',
    title: 'Agent Guidelines',
    path: 'AGENTS.md',
    summary: 'Coding conventions and workflow expectations for contributors.',
  },
]
