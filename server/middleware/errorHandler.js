// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  console.error('[server] Error:', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
}
