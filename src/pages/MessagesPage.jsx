import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, queueManager } from '../lib/db'
import { useNetwork } from '../hooks/useNetwork'
import './MessagesPage.css'

const ROOM_ID = 'general'
const AUTHOR_KEY = 'bufferapp_author'

export default function MessagesPage() {
  const { isOnline } = useNetwork()
  const [text, setText] = useState('')
  const [author, setAuthor] = useState(() => localStorage.getItem(AUTHOR_KEY) || 'Yo')
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [authorDraft, setAuthorDraft] = useState(author)
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()
  const listRef = useRef()

  const PAGE_SIZE = 30

  const messages = useLiveQuery(
    () => db.messages.where('roomId').equals(ROOM_ID).sortBy('createdAt'),
    []
  ) ?? []

  // Fetch mensajes del servidor al montar y cada 10s mientras online y la pestaña visible
  useEffect(() => {
    if (!isOnline) return

    fetchFromServer()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchFromServer()
    }, 10000)

    const onVisible = () => { if (isOnline) fetchFromServer() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isOnline])

  // Scroll al último mensaje solo si el usuario ya estaba al fondo
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    if (distFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  async function fetchFromServer(beforeDate) {
    try {
      const url = beforeDate
        ? `/api/messages/${ROOM_ID}?limit=${PAGE_SIZE}&before=${encodeURIComponent(beforeDate)}`
        : `/api/messages/${ROOM_ID}?limit=${PAGE_SIZE}`
      const res = await fetch(url)
      if (!res.ok) return
      const serverMessages = await res.json()

      let added = 0
      for (const msg of serverMessages) {
        const exists = await db.messages.where('serverId').equals(msg.id).count()
        if (exists === 0) {
          await db.messages.add({
            serverId: msg.id,
            roomId: msg.roomId,
            content: msg.content,
            author: msg.author,
            createdAt: msg.createdAt,
            synced: true,
          })
          added++
        }
      }

      // Si el servidor devolvió PAGE_SIZE mensajes puede haber más
      if (!beforeDate) setHasMore(serverMessages.length === PAGE_SIZE)
      return added
    } catch {
      // sin conexión o servidor caído — silencioso
    }
  }

  async function loadMore() {
    const oldest = messages[0]
    if (!oldest) return
    setLoadingMore(true)
    const prevScrollHeight = listRef.current?.scrollHeight ?? 0
    await fetchFromServer(oldest.createdAt)
    // Mantiene la posición de scroll al insertar mensajes arriba
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight - prevScrollHeight
      }
    })
    setLoadingMore(false)
    setHasMore(false)
  }

  async function sendMessage() {
    const content = text.trim()
    if (!content || sending) return
    setText('')
    setSending(true)

    const msg = {
      roomId: ROOM_ID,
      content,
      author,
      createdAt: new Date().toISOString(),
    }

    if (isOnline) {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        })
        if (res.ok) {
          const saved = await res.json()
          await db.messages.add({
            serverId: saved.id,
            roomId: saved.roomId,
            content: saved.content,
            author: saved.author,
            createdAt: saved.createdAt,
            synced: true,
          })
          setSending(false)
          inputRef.current?.focus()
          return
        }
      } catch {
        // fallthrough al path offline
      }
    }

    // Path offline: guarda localmente y encola
    const localId = await db.messages.add({ ...msg, synced: false })
    await queueManager.enqueue('SEND_MESSAGE', { ...msg, localId })
    setSending(false)
    inputRef.current?.focus()
  }

  function saveAuthor() {
    const name = authorDraft.trim() || 'Yo'
    setAuthor(name)
    localStorage.setItem(AUTHOR_KEY, name)
    setEditingAuthor(false)
    inputRef.current?.focus()
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateLabel(iso) {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Hoy'
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
  }

  // Agrupa mensajes por fecha insertando separadores
  function buildItems(msgs) {
    const items = []
    let lastDate = null
    for (const msg of msgs) {
      const dateKey = new Date(msg.createdAt).toDateString()
      if (dateKey !== lastDate) {
        items.push({ type: 'divider', label: formatDateLabel(msg.createdAt), key: dateKey })
        lastDate = dateKey
      }
      items.push({ type: 'msg', ...msg })
    }
    return items
  }

  const items = buildItems(messages)

  return (
    <div className="messages-page">
      {/* Header */}
      <div className="messages-header">
        <div className="room-pill">
          <span className="room-hash">#</span>
          <span className="room-name">{ROOM_ID}</span>
          {!isOnline && <span className="offline-chip">offline</span>}
        </div>
        <div className="author-area">
          {editingAuthor ? (
            <div className="author-edit">
              <input
                className="author-input"
                value={authorDraft}
                maxLength={24}
                onChange={e => setAuthorDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveAuthor(); if (e.key === 'Escape') setEditingAuthor(false) }}
                autoFocus
              />
              <button className="btn-ok" onClick={saveAuthor}>OK</button>
            </div>
          ) : (
            <button className="btn-author" onClick={() => { setAuthorDraft(author); setEditingAuthor(true) }}>
              {author} ✎
            </button>
          )}
        </div>
      </div>

      {/* Lista de mensajes */}
      <div className="messages-list" ref={listRef}>
        {/* Botón cargar más — aparece cuando el servidor tiene mensajes anteriores */}
        {hasMore && isOnline && messages.length > 0 && (
          <div className="load-more-row">
            <button className="btn-load-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Cargando...' : 'Cargar mensajes anteriores'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="messages-empty">
            <div className="empty-icon">💬</div>
            <p>Ningún mensaje en esta sala.</p>
            <p className="empty-sub">Los mensajes enviados sin conexión se sincronizan automáticamente al reconectar.</p>
          </div>
        )}

        {items.map((item, i) =>
          item.type === 'divider' ? (
            <div key={item.key} className="date-divider">
              <span>{item.label}</span>
            </div>
          ) : (
            <div
              key={item.id ?? i}
              className={`message ${item.author === author ? 'mine' : 'theirs'}`}
            >
              {item.author !== author && (
                <div className="msg-author">{item.author}</div>
              )}
              <div className="msg-bubble">
                <span className="msg-content">{item.content}</span>
                <span className="msg-time">
                  {formatTime(item.createdAt)}
                  {!item.synced && <span className="msg-pending"> · pendiente</span>}
                </span>
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="messages-input-bar">
        <input
          ref={inputRef}
          className="msg-input"
          placeholder={isOnline ? 'Escribe un mensaje...' : 'Offline — se enviará al reconectar'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          disabled={sending}
        />
        <button
          className="btn-send"
          onClick={sendMessage}
          disabled={!text.trim() || sending}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
