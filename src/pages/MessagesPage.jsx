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
  const bottomRef = useRef()
  const inputRef = useRef()

  const messages = useLiveQuery(
    () => db.messages.where('roomId').equals(ROOM_ID).sortBy('createdAt'),
    []
  ) ?? []

  // Fetch mensajes del servidor al montar y cada 10s mientras online
  useEffect(() => {
    if (!isOnline) return
    fetchFromServer()
    const interval = setInterval(fetchFromServer, 10000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function fetchFromServer() {
    try {
      const res = await fetch(`/api/messages/${ROOM_ID}`)
      if (!res.ok) return
      const serverMessages = await res.json()
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
        }
      }
    } catch {
      // sin conexión o servidor caído — silencioso
    }
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
      <div className="messages-list">
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
