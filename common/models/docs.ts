import type { DocDescriptor } from '../docs/manifest'

export type DocSummary = Pick<DocDescriptor, 'slug' | 'title' | 'summary'>

export type DocContent = DocSummary & {
  content: string
}
