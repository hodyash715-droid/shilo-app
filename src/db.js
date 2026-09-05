import { supabase } from './supabase.js'

// המרה בין שורת DB (snake_case) לצורת האפליקציה (camelCase)
const fromRow = r => ({
  id: r.id,
  title: r.title || '',
  client: r.client || '',
  contact: r.contact || '',
  eventDate: r.event_date,
  status: r.status || 'inquiry',
  price: r.price || 0,
  items: Array.isArray(r.items) ? r.items : [],
  team: Array.isArray(r.team) ? r.team : [],
  note: r.note || '',
})

const toRow = j => ({
  title: j.title,
  client: j.client,
  contact: j.contact,
  event_date: j.eventDate,
  status: j.status,
  price: j.price,
  items: j.items,
  team: j.team,
  note: j.note,
})

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return data.map(fromRow)
}

export async function createJob(job) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(toRow(job))
    .select()
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function updateJob(id, patch) {
  // patch בצורת האפליקציה; ממירים רק את השדות שקיימים
  const row = {}
  const map = { title:'title', client:'client', contact:'contact', eventDate:'event_date',
    status:'status', price:'price', items:'items', team:'team', note:'note' }
  for (const k in patch) if (map[k] !== undefined) row[map[k]] = patch[k]
  const { data, error } = await supabase
    .from('jobs')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteJob(id) {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

// ---------- עובדים ----------
export async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createEmployee(emp) {
  const { data, error } = await supabase.from('employees').insert(emp).select().single()
  if (error) throw error
  return data
}

export async function updateEmployee(id, patch) {
  const { data, error } = await supabase.from('employees').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}
