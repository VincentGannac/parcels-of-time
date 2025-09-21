// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:locale(fr|en)/login',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },
      {
        source: '/:locale(fr|en)/account',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },
      {
        source: '/:locale(fr|en)/claim',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },

      {
          source: '/:locale(fr|en)/forgot',
          headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
        },
        {
          source: '/:locale(fr|en)/reset',
          headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
        },
    ]
  },
}

export default config
