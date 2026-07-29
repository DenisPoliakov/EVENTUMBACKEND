import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'

import { api } from '../api/client'
import { useSupportTicket, useSupportTickets } from '../api/hooks'
import type { SupportTicketPriority, SupportTicketStatus } from '../types'

function SupportPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const tickets = useSupportTickets(statusFilter || undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeTicketId = selectedId ?? tickets.data?.[0]?.id ?? null
  const detail = useSupportTicket(activeTicketId)
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['support-tickets'] }),
      qc.invalidateQueries({ queryKey: ['support-ticket', activeTicketId] }),
    ])
  }
  const patch = useMutation({
    mutationFn: async (payload: { status?: SupportTicketStatus; priority?: SupportTicketPriority }) =>
      api.patch(`/support/${activeTicketId}`, payload),
    onSuccess: refresh,
  })
  const addMessage = useMutation({
    mutationFn: async ({ body, internal }: { body: string; internal: boolean }) =>
      api.post(`/support/${activeTicketId}/${internal ? 'notes' : 'replies'}`, { body }),
    onSuccess: async (_data, variables) => {
      if (variables.internal) setNote('')
      else setReply('')
      await refresh()
    },
  })

  return (
    <div>
      <div className="section-header">
        <div><div className="small-label">Очередь поддержки</div><h2 style={{ margin: '4px 0 0' }}>Тикеты пользователей</h2></div>
        <select className="select" style={{ width: 220 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Все статусы</option>
          {['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'].map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, .8fr) minmax(420px, 1.2fr)', gap: 16 }}>
        <div className="panel">
          {tickets.data?.map((ticket) => (
            <button key={ticket.id} className={`crm-client-row ${activeTicketId === ticket.id ? 'active' : ''}`} onClick={() => setSelectedId(ticket.id)} style={{ marginBottom: 8 }}>
              <span><strong>{ticket.subject}</strong><br /><span className="small-label">{ticket.user.name || ticket.user.email}</span></span>
              <span className="small-label">{ticket.priority}<br />{ticket.status}</span>
            </button>
          ))}
        </div>
        <div className="panel">
          {!detail.data ? <p className="small-label">Выберите тикет.</p> : (
            <>
              <div className="section-header">
                <div><h3>{detail.data.subject}</h3><span className="small-label">{detail.data.user.email}</span></div>
                <div className="actions-row">
                  <select className="select" value={detail.data.priority} onChange={(event) => patch.mutate({ priority: event.target.value as SupportTicketPriority })}>
                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                  <select className="select" value={detail.data.status} onChange={(event) => patch.mutate({ status: event.target.value as SupportTicketStatus })}>
                    {['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div>
                {detail.data.messages?.map((message) => (
                  <div key={message.id} className="panel" style={{ marginTop: 8, borderColor: message.isInternal ? '#ca8a04' : undefined }}>
                    <strong>{message.isInternal ? 'Внутренняя заметка' : message.authorType}</strong>
                    <span className="small-label" style={{ float: 'right' }}>{dayjs(message.createdAt).format('DD.MM.YYYY HH:mm')}</span>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
                  </div>
                ))}
              </div>
              <textarea className="textarea" rows={3} placeholder="Ответ пользователю" value={reply} onChange={(event) => setReply(event.target.value)} style={{ marginTop: 12 }} />
              <button className="button" disabled={!reply.trim() || addMessage.isPending} onClick={() => addMessage.mutate({ body: reply, internal: false })}>Отправить ответ</button>
              <textarea className="textarea" rows={2} placeholder="Внутренняя заметка (не видна пользователю)" value={note} onChange={(event) => setNote(event.target.value)} style={{ marginTop: 12 }} />
              <button className="button button-muted" disabled={!note.trim() || addMessage.isPending} onClick={() => addMessage.mutate({ body: note, internal: true })}>Добавить заметку</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SupportPage
