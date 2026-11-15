import type { ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { twMerge } from 'tailwind-merge'

const ALLOWED_ELEMENTS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]

const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target='_blank' rel='noopener noreferrer' />
  ),
}

type MarkdownProps = Readonly<
  Omit<ComponentProps<'div'>, 'children'> & { children: string }
>

export default function Markdown({
  children,
  className,
  ...props
}: MarkdownProps) {
  return (
    <div
      className={twMerge(
        'space-y-2 wrap-break-word',
        '[&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:text-foreground [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground',
        '[&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0 [&_input]:mr-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3',
        '[&_code]:rounded-sm [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-foreground/10 [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:border-border',
        '[&_:is(td,th)]:border [&_:is(td,th)]:border-border [&_:is(td,th)]:px-2 [&_:is(td,th)]:py-1 [&_table]:w-full [&_table]:text-sm [&_th]:text-left',
        className
      )}
      {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
