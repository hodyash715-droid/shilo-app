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

// העובד שמשויך למשתמש המחובר (null = מנהל)
export async function fetchEmployeeByUser(userId) {
  const { data, error } = await supabase
    .from('employees').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

// חיפוש עובד לפי קוד הצטרפות (נקרא אחרי ההרשמה)
export async function findEmployeeByCode(code) {
  const { data, error } = await supabase
    .from('employees').select('*').eq('join_code', code.toUpperCase()).maybeSingle()
  if (error) throw error
  return data
}

export async function linkEmployeeToUser(empId, userId) {
  const { data, error } = await supabase
    .from('employees').update({ user_id: userId }).eq('id', empId).select().single()
  if (error) throw error
  return data
}

// ---------- משמרות ----------
export async function fetchShifts() {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data.map(r => ({ ...r, assigned: Array.isArray(r.assigned) ? r.assigned : [] }))
}

export async function createShift(sh) {
  const { data, error } = await supabase.from('shifts').insert(sh).select().single()
  if (error) throw error
  return { ...data, assigned: data.assigned || [] }
}

export async function updateShift(id, patch) {
  const { data, error } = await supabase.from('shifts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return { ...data, assigned: data.assigned || [] }
}

export async function deleteShift(id) {
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw error
}

// ---------- מלאי ----------
export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createInvItem(it) {
  const { data, error } = await supabase.from('inventory').insert(it).select().single()
  if (error) throw error
  return data
}

export async function updateInvItem(id, patch) {
  const { data, error } = await supabase.from('inventory').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteInvItem(id) {
  const { error } = await supabase.from('inventory').delete().eq('id', id)
  if (error) throw error
}

// ---------- זמינות ----------
export async function fetchAvailability() {
  const { data, error } = await supabase.from('availability').select('*')
  if (error) throw error
  return data
}

export async function setAvailability(employee_id, date, status, start_time = null, end_time = null) {
  const { data, error } = await supabase
    .from('availability')
    .upsert({ employee_id, date, status, start_time, end_time }, { onConflict: 'employee_id,date' })
    .select().single()
  if (error) throw error
  return data
}

export async function clearAvailability(employee_id, date) {
  const { error } = await supabase.from('availability').delete()
    .eq('employee_id', employee_id).eq('date', date)
  if (error) throw error
}
