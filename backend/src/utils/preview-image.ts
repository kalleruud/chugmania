import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement as h, type ReactNode } from 'react'
import satori, { type Font, type FontWeight } from 'satori'

export const PREVIEW_IMAGE_WIDTH = 1200
export const PREVIEW_IMAGE_HEIGHT = 630

const PRIMARY = '#E53905'
const fontWeights: FontWeight[] = [400, 700, 900]
const assetRoot = path.resolve(
  process.env.NODE_ENV === 'production' ? 'dist' : 'public'
)

export type PreviewBadge = {
  label: string
  dot?: string
  primary?: boolean
}

export type PreviewCard = {
  kind: string
  title: string
  titlePrefix?: string
  lines: string[]
  badges: PreviewBadge[]
}

type Assets = { fonts: Font[]; logo: string }

let assets: Promise<Assets> | undefined

function loadAssets(): Promise<Assets> {
  assets ??= Promise.all([
    Promise.all(
      fontWeights.flatMap(weight =>
        ['latin', 'latin-ext'].map(async (subset): Promise<Font> => ({
          name: 'Titillium Web',
          weight,
          style: 'normal',
          data: await readFile(
            path.join(
              assetRoot,
              'fonts/titillium-web',
              `titillium-web-${subset}-${weight}-normal.woff`
            )
          ),
        }))
      )
    ),
    readFile(path.join(assetRoot, 'cm.svg')),
  ])
    .then(([fonts, logo]) => ({
      fonts,
      logo: `data:image/svg+xml;base64,${logo.toString('base64')}`,
    }))
    .catch((error: unknown) => {
      assets = undefined
      throw error
    })
  return assets
}

function getTitleSize(title: string): number {
  if (title.length > 48) return 64
  if (title.length > 26) return 80
  return 108
}

function Badge({ label, dot, primary }: PreviewBadge): ReactNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 24px',
        borderRadius: 999,
        fontSize: 30,
        fontWeight: 700,
        color: 'white',
        backgroundColor: primary ? PRIMARY : '#1c1c1c',
        border: `2px solid ${primary ? PRIMARY : '#333333'}`,
      },
    },
    dot &&
      h('div', {
        style: {
          width: 18,
          height: 18,
          borderRadius: 999,
          backgroundColor: dot,
          border: '2px solid #525252',
        },
      }),
    label
  )
}

function Card(card: PreviewCard, logo: string): ReactNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        backgroundImage: `radial-gradient(circle at 100% 0%, ${PRIMARY}40 0%, transparent 55%)`,
        fontFamily: 'Titillium Web',
        color: 'white',
      },
    },
    h('div', {
      style: { width: 20, height: '100%', backgroundColor: PRIMARY },
    }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '56px 72px 64px 64px',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        h('img', { src: logo, width: 145, height: 60 }),
        h(
          'div',
          {
            style: {
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#a3a3a3',
            },
          },
          card.kind
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            gap: 12,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'block',
              fontSize: getTitleSize(card.title),
              fontWeight: 900,
              lineHeight: 1.02,
              textTransform: 'uppercase',
              lineClamp: 2,
            },
          },
          card.titlePrefix &&
            h('span', { style: { color: PRIMARY } }, card.titlePrefix),
          card.title
        ),
        ...card.lines.map(line =>
          h(
            'div',
            {
              style: {
                display: 'block',
                fontSize: 36,
                color: '#d4d4d4',
                lineClamp: 1,
              },
            },
            line
          )
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: 16, flexWrap: 'wrap' } },
        ...card.badges.map(badge => Badge(badge))
      )
    )
  )
}

export async function renderPreviewImage(card: PreviewCard): Promise<Buffer> {
  const { fonts, logo } = await loadAssets()
  const svg = await satori(Card(card, logo), {
    width: PREVIEW_IMAGE_WIDTH,
    height: PREVIEW_IMAGE_HEIGHT,
    fonts,
  })
  return new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng()
}
