import type { Context } from 'hono'

export const getRoot = (c: Context) => c.text('Hello Hono!')

