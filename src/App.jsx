import React, { useState } from 'react'
import { JOBS, TODAY, isoLocal } from './data.js'
import Header from './components/Header.jsx'
import Board from './components/Board.jsx'
import Calendar from './components/Calendar.jsx'
import JobDetail from './components/JobDetail.jsx'

export default function App() {
  const [jobs, setJobs] = useState(JOBS)
  const [view, setView] = useState('board')
  const [openId, setOpenId] = useState(null)

  const openJob = jobs.find(j => j.id === openId) || null

  const setStatus = (id, statusId) =>
    setJobs(js => js.map(j => (j.id === id ? { ...j, status: statusId } : j)))

  const newJob = () => {
    const id = `job_new_${Date.now()}`
    const eventDate = isoLocal(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 14))
    setJobs(js => [{
      id, client: 'לקוח חדש', contact: '', title: 'עבודה חדשה',
      eventDate, status: 'inquiry', price: 0, items: [], team: [], note: '',
    }, ...js])
    setOpenId(id)
  }

  return (
    <div style={{ minHeight: '100%', paddingBottom: 40 }}>
      <Header view={view} setView={setView} onNew={newJob} />
      {view === 'board'
        ? <Board jobs={jobs} onOpen={j => setOpenId(j.id)} />
        : <Calendar jobs={jobs} onOpen={j => setOpenId(j.id)} />}
      {openJob && (
        <JobDetail job={openJob} onClose={() => setOpenId(null)} onStatus={setStatus} />
      )}
    </div>
  )
}
