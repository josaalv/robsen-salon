import React, { useState, useEffect } from 'react'
import { mxn, mxn0 } from '../lib/helpers'

/* ---- Phosphor Icons (via npm package) ---- */
export { PhosphorIcon as Ic } from './PhosphorIcon'

/* ---- Avatar ---- */
interface AvatarProps { ini: string; color?: string | null; size?: 'sm' | 'lg'; src?: string | null }
export function Avatar({ ini, color, size, src }: AvatarProps) {
  const cls = 'avatar' + (size ? ' ' + size : '')
  if (src) return <img src={src} alt={ini} className={cls} style={{ objectFit: 'cover', borderRadius: '50%' }} />
  const style = color ? { background: color, color: '#1a1410' } : undefined
  return <div className={cls} style={style}>{ini}</div>
}
