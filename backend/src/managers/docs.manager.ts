import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { docsManifest, type DocDescriptor } from '../../../common/docs/manifest'

type DocSummary = Pick<DocDescriptor, 'slug' | 'title' | 'summary'>

export default class DocsManager {
  private static resolvePath(docPath: string) {
    const absolute = path.resolve(process.cwd(), docPath)
    const root = process.cwd()
    if (!absolute.startsWith(root)) {
      throw new Error('Attempted to access a file outside the workspace')
    }
    return absolute
  }

  static listDocs(): DocSummary[] {
    return docsManifest.map(({ slug, title, summary }) => ({
      slug,
      title,
      summary,
    }))
  }

  static async getDoc(slug: string) {
    const match = docsManifest.find(doc => doc.slug === slug)
    if (!match) throw new Error('Document not found')

    const filePath = DocsManager.resolvePath(match.path)
    const content = await readFile(filePath, 'utf8')
    return {
      slug: match.slug,
      title: match.title,
      summary: match.summary,
      content,
    }
  }
}
