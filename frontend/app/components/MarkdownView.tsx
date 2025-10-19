import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
}

export default function MarkdownView({ content }: Props) {
  return (
    <article className='docs-markdown'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
