/**
 * ============================================================
 *  CRM UpLife — script.js
 *  Integração com Supabase + n8n
 *  localStorage mantido apenas como fallback offline
 * ============================================================
 */

// ============================================================
// ⚙️  CONFIGURAÇÃO — PREENCHA ANTES DE USAR
// ============================================================

const SUPABASE_URL     = "https://ropuhydxmpoxpfvyrsiq.supabase.co";   // ← sua URL do Supabase
const SUPABASE_ANON_KEY = "sb_publishable_r7n9Ijpb8LlM37nnln2rzQ_GBDqhcMD";                      // ← sua anon key (nunca service_role no front)
const N8N_WEBHOOK_URL  = "https://suporteuplife.app.n8n.cloud/webhook/novo-lead-whatsapp-uplife"; // ← seu webhook no n8n

// ============================================================
// CLIENTE SUPABASE
// ============================================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Indica se Supabase está configurado (detectado pelas strings placeholder)
const SUPABASE_CONFIGURED = !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-ANON');
const N8N_CONFIGURED      = !N8N_WEBHOOK_URL.includes('SEU-N8N');

// ============================================================
// CONFIGURAÇÃO DAS ETAPAS DO FUNIL
// ============================================================

const STAGES = [
  { id: 'Leads de Entrada',       colorClass: 'col-entrada',    icon: '📥', color: '#3b82f6' },
  { id: 'Primeiro Contato',       colorClass: 'col-contato',    icon: '👋', color: '#8b5cf6' },
  { id: 'Interessado',            colorClass: 'col-interesse',  icon: '⭐', color: '#f59e0b' },
  { id: 'Em Atendimento',         colorClass: 'col-atendimento',icon: '📞', color: '#0ea5e9' },
  { id: 'Documentação/Matrícula', colorClass: 'col-doc',        icon: '📋', color: '#ec4899' },
  { id: 'Aguardando Pagamento',   colorClass: 'col-pagamento',  icon: '💳', color: '#f97316' },
  { id: 'Matriculado',            colorClass: 'col-matriculado',icon: '🎓', color: '#22c55e' },
];

// ============================================================
// ESTADO GLOBAL
// ============================================================

let leads = [];
let draggedLeadId   = null;
let currentDetailLeadId = null;
let activeFilters   = { search: '', origin: '', responsible: '', status: '' };
let selectedTags    = [];

// ============================================================
// DADOS FAKE — usados quando Supabase não está configurado
// ============================================================

const FAKE_LEADS = [
  {
    id: 'lead_001', name: 'Mariana Costa', phone: '41991234001',
    course_interest: 'Técnico em Segurança do Trabalho', source: 'WhatsApp',
    stage: 'Leads de Entrada', status: 'Novo', responsible: 'Lucas',
    notes: 'Lead veio pelo status do Instagram. Perguntou sobre bolsas.',
    last_message: 'Olá! Tenho interesse no curso de Segurança do Trabalho, podem me informar os valores?',
    last_interaction: '2026-06-02T09:15:00', created_at: '2026-06-02T09:00:00',
    tags: ['WhatsApp'],
    messages: [{ text: 'Olá! Tenho interesse no curso de Segurança do Trabalho, podem me informar os valores?', direction: 'in', received_at: '2026-06-02T09:15:00' }],
    movements: [{ from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-06-02T09:00:00' }]
  },
  {
    id: 'lead_002', name: 'Rafael Almeida', phone: '41991234002',
    course_interest: 'Técnico em Enfermagem', source: 'Instagram',
    stage: 'Primeiro Contato', status: 'Em atendimento', responsible: 'Lucas',
    notes: 'Já mandei as informações do curso. Aguardando retorno.',
    last_message: 'Obrigado pelas informações! Vou pensar e te retorno.',
    last_interaction: '2026-06-01T14:22:00', created_at: '2026-05-30T10:00:00',
    tags: ['Retornar'],
    messages: [
      { text: 'Oi, vi o anúncio no Instagram. Tenho interesse no Técnico em Enfermagem.', direction: 'in', received_at: '2026-05-30T10:00:00' },
      { text: 'Obrigado pelas informações! Vou pensar e te retorno.', direction: 'in', received_at: '2026-06-01T14:22:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-30T10:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Primeiro Contato', moved_at: '2026-05-30T11:00:00' }
    ]
  },
  {
    id: 'lead_003', name: 'Juliana Ferreira', phone: '41991234003',
    course_interest: 'Técnico em Administração', source: 'Site',
    stage: 'Interessado', status: 'Quente', responsible: 'Lucas',
    notes: 'Muito interessada! Quer começar na próxima turma.',
    last_message: 'Adorei a proposta! Tenho interesse na bolsa de 20%. Como faço para reservar minha vaga?',
    last_interaction: '2026-06-02T08:00:00', created_at: '2026-05-28T09:00:00',
    tags: ['Bolsa'],
    messages: [
      { text: 'Vim pelo site, quero saber mais sobre o Técnico em Administração.', direction: 'in', received_at: '2026-05-28T09:00:00' },
      { text: 'Adorei a proposta! Tenho interesse na bolsa de 20%. Como faço para reservar minha vaga?', direction: 'in', received_at: '2026-06-02T08:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-28T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Primeiro Contato', moved_at: '2026-05-28T10:00:00' },
      { from_stage: 'Primeiro Contato', to_stage: 'Interessado', moved_at: '2026-06-01T09:00:00' }
    ]
  },
  {
    id: 'lead_004', name: 'Bruno Tavares', phone: '41991234004',
    course_interest: 'Técnico em Eletrotécnica', source: 'Indicação',
    stage: 'Em Atendimento', status: 'Em atendimento', responsible: 'Lucas',
    notes: 'Indicado pelo Pedro. Reunião marcada para amanhã.',
    last_message: 'Sim, posso comparecer na reunião amanhã às 10h.',
    last_interaction: '2026-06-01T16:30:00', created_at: '2026-05-25T09:00:00',
    tags: ['Urgente'],
    messages: [
      { text: 'Olá, sou indicado pelo Pedro. Tenho interesse no Técnico em Eletrotécnica.', direction: 'in', received_at: '2026-05-25T09:00:00' },
      { text: 'Sim, posso comparecer na reunião amanhã às 10h.', direction: 'in', received_at: '2026-06-01T16:30:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-25T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Primeiro Contato', moved_at: '2026-05-26T09:00:00' },
      { from_stage: 'Primeiro Contato', to_stage: 'Interessado', moved_at: '2026-05-27T09:00:00' },
      { from_stage: 'Interessado', to_stage: 'Em Atendimento', moved_at: '2026-05-29T09:00:00' }
    ]
  },
  {
    id: 'lead_005', name: 'Carla Mendes', phone: '41991234005',
    course_interest: 'Técnico em Meio Ambiente', source: 'Facebook',
    stage: 'Em Atendimento', status: 'Sem resposta', responsible: 'Lucas',
    notes: 'Ficou de enviar documentos mas não retornou.',
    last_message: 'Vou verificar os documentos aqui e te mando.',
    last_interaction: '2026-05-28T11:00:00', created_at: '2026-05-20T09:00:00',
    tags: ['Retornar', 'Documentação'],
    messages: [
      { text: 'Vi o anúncio do Facebook sobre o curso de Meio Ambiente.', direction: 'in', received_at: '2026-05-20T09:00:00' },
      { text: 'Vou verificar os documentos aqui e te mando.', direction: 'in', received_at: '2026-05-28T11:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-20T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Primeiro Contato', moved_at: '2026-05-21T09:00:00' },
      { from_stage: 'Primeiro Contato', to_stage: 'Interessado', moved_at: '2026-05-23T09:00:00' },
      { from_stage: 'Interessado', to_stage: 'Em Atendimento', moved_at: '2026-05-26T09:00:00' }
    ]
  },
  {
    id: 'lead_006', name: 'Diego Santos', phone: '41991234006',
    course_interest: 'Técnico em Informática', source: 'WhatsApp',
    stage: 'Documentação/Matrícula', status: 'Em atendimento', responsible: 'Lucas',
    notes: 'Enviou RG e CPF. Falta comprovante de residência.',
    last_message: 'Enviei os documentos! Falta só o comprovante de residência.',
    last_interaction: '2026-06-01T10:00:00', created_at: '2026-05-15T09:00:00',
    tags: ['Documentação', 'WhatsApp'],
    messages: [
      { text: 'Olá, tenho interesse no Técnico em Informática.', direction: 'in', received_at: '2026-05-15T09:00:00' },
      { text: 'Enviei os documentos! Falta só o comprovante de residência.', direction: 'in', received_at: '2026-06-01T10:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-15T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Primeiro Contato', moved_at: '2026-05-16T09:00:00' },
      { from_stage: 'Primeiro Contato', to_stage: 'Em Atendimento', moved_at: '2026-05-20T09:00:00' },
      { from_stage: 'Em Atendimento', to_stage: 'Documentação/Matrícula', moved_at: '2026-05-28T09:00:00' }
    ]
  },
  {
    id: 'lead_007', name: 'Patrícia Lima', phone: '41991234007',
    course_interest: 'Técnico em Segurança do Trabalho', source: 'Presencial',
    stage: 'Aguardando Pagamento', status: 'Quente', responsible: 'Lucas',
    notes: 'Boleto enviado. Aguardando pagamento da primeira parcela até dia 05.',
    last_message: 'Recebi o boleto. Vou pagar até sexta-feira!',
    last_interaction: '2026-06-01T15:00:00', created_at: '2026-05-10T09:00:00',
    tags: ['Pagamento', 'Urgente'],
    messages: [
      { text: 'Vim à unidade e quero me matricular no Segurança do Trabalho.', direction: 'in', received_at: '2026-05-10T09:00:00' },
      { text: 'Recebi o boleto. Vou pagar até sexta-feira!', direction: 'in', received_at: '2026-06-01T15:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-10T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Aguardando Pagamento', moved_at: '2026-05-30T09:00:00' }
    ]
  },
  {
    id: 'lead_008', name: 'Lucas Oliveira', phone: '41991234008',
    course_interest: 'Técnico em Contabilidade', source: 'Site',
    stage: 'Aguardando Pagamento', status: 'Quente', responsible: 'Lucas',
    notes: 'Pediu parcelamento em 12x. Aprovado pelo financeiro.',
    last_message: 'Ótimo! Vou pagar a entrada hoje mesmo.',
    last_interaction: '2026-06-02T07:30:00', created_at: '2026-05-08T09:00:00',
    tags: ['Pagamento'],
    messages: [
      { text: 'Olá! Vi no site sobre o Técnico em Contabilidade.', direction: 'in', received_at: '2026-05-08T09:00:00' },
      { text: 'Ótimo! Vou pagar a entrada hoje mesmo.', direction: 'in', received_at: '2026-06-02T07:30:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-08T09:00:00' },
      { from_stage: 'Leads de Entrada', to_stage: 'Aguardando Pagamento', moved_at: '2026-05-28T09:00:00' }
    ]
  },
  {
    id: 'lead_009', name: 'Amanda Rocha', phone: '41991234009',
    course_interest: 'Técnico em Enfermagem', source: 'WhatsApp',
    stage: 'Matriculado', status: 'Convertido', responsible: 'Lucas',
    notes: 'Matriculada! Turma de julho/2026. Pagamento confirmado.',
    last_message: 'Pagamento confirmado! Muito obrigada pela atenção de todos 😊',
    last_interaction: '2026-05-31T16:00:00', created_at: '2026-05-01T09:00:00',
    tags: ['WhatsApp'],
    messages: [
      { text: 'Oi, quero informações sobre o Técnico em Enfermagem.', direction: 'in', received_at: '2026-05-01T09:00:00' },
      { text: 'Pagamento confirmado! Muito obrigada pela atenção de todos 😊', direction: 'in', received_at: '2026-05-31T16:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-05-01T09:00:00' },
      { from_stage: 'Aguardando Pagamento', to_stage: 'Matriculado', moved_at: '2026-05-31T16:00:00' }
    ]
  },
  {
    id: 'lead_010', name: 'Fernando Gomes', phone: '41991234010',
    course_interest: 'Técnico em Eletrotécnica', source: 'Indicação',
    stage: 'Matriculado', status: 'Convertido', responsible: 'Lucas',
    notes: 'Matriculado via indicação. Turma agosto/2026.',
    last_message: 'Matriculado! Obrigado pela oportunidade.',
    last_interaction: '2026-05-29T11:00:00', created_at: '2026-04-25T09:00:00',
    tags: ['WhatsApp'],
    messages: [
      { text: 'Oi, fui indicado. Quero o Técnico em Eletrotécnica.', direction: 'in', received_at: '2026-04-25T09:00:00' },
      { text: 'Matriculado! Obrigado pela oportunidade.', direction: 'in', received_at: '2026-05-29T11:00:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-04-25T09:00:00' },
      { from_stage: 'Aguardando Pagamento', to_stage: 'Matriculado', moved_at: '2026-05-29T11:00:00' }
    ]
  }
];

// ============================================================
// UTILITÁRIOS
// ============================================================

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function generateId() {
  return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = (now - d) / 1000 / 60;
  if (diff < 1)    return 'Agora';
  if (diff < 60)   return `${Math.floor(diff)}min atrás`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getInitials(name) {
  return (name || 'ND').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function showToast(msg, type = '') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setSupabaseStatus(connected) {
  const dot   = document.getElementById('supabaseDot');
  const label = document.getElementById('supabaseLabel');
  if (!dot || !label) return;
  dot.style.background = connected ? '#22c55e' : '#ef4444';
  label.textContent    = connected ? 'Supabase ✓' : 'Offline';
}

// ============================================================
// LOCALSTORAGE — fallback quando Supabase não está configurado
// ============================================================

function saveToLocalStorage() {
  localStorage.setItem('uplife_crm_leads', JSON.stringify(leads));
}

function loadFromLocalStorage() {
  const data = localStorage.getItem('uplife_crm_leads');
  if (data) {
    leads = JSON.parse(data);
  } else {
    leads = FAKE_LEADS.map(l => ({ ...l }));
    saveToLocalStorage();
  }
  setSupabaseStatus(false);
  renderLeads();
}

// ============================================================
// SUPABASE — CARREGAR LEADS
// ============================================================

async function loadFromSupabase() {
  const { data, error } = await supabaseClient
    .from('leads')
    .select(`
      *,
      lead_messages (*),
      lead_movements (*),
      lead_tags (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar leads do Supabase:', error);
    showToast('Supabase indisponível. Usando dados locais.', 'warning');
    setSupabaseStatus(false);
    loadFromLocalStorage();
    return;
  }

  setSupabaseStatus(true);

  leads = data.map(lead => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    course_interest: lead.course_interest || '',
    source: lead.source || '',
    stage: lead.stage,
    status: lead.status || 'Novo',
    responsible: lead.responsible || '',
    notes: lead.notes || '',
    last_message: lead.last_message || '',
    last_interaction: lead.last_interaction,
    created_at: lead.created_at,
    tags: lead.lead_tags     ? lead.lead_tags.map(t => t.tag)           : [],
    messages: lead.lead_messages ? lead.lead_messages
      .sort((a, b) => new Date(a.received_at) - new Date(b.received_at))
      .map(m => ({ text: m.message, direction: m.direction, received_at: m.received_at })) : [],
    movements: lead.lead_movements ? lead.lead_movements
      .sort((a, b) => new Date(a.moved_at) - new Date(b.moved_at))
      .map(m => ({ from_stage: m.from_stage, to_stage: m.to_stage, moved_at: m.moved_at })) : [],
  }));

  renderLeads();
}

// ============================================================
// SUPABASE REALTIME — atualiza CRM automaticamente
// ============================================================

function subscribeToLeadsRealtime() {
  supabaseClient
    .channel('crm-leads-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, async () => {
      await loadFromSupabase();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_messages' }, async () => {
      await loadFromSupabase();
    })
    .subscribe(status => {
      console.log('[Supabase Realtime]', status);
    });
}

// ============================================================
// CRIAR LEAD
// ============================================================

async function createLead(data) {
  const now = new Date().toISOString();

  if (!SUPABASE_CONFIGURED) {
    // Fallback local
    const lead = {
      id: generateId(),
      name: data.name,
      phone: normalizePhone(data.phone),
      course_interest: data.course_interest || '',
      source: data.source || 'WhatsApp',
      stage: data.stage || 'Leads de Entrada',
      status: data.status || 'Novo',
      responsible: data.responsible || 'Lucas',
      notes: data.notes || '',
      last_message: data.last_message || '',
      last_interaction: now,
      created_at: now,
      tags: data.tags || [],
      messages: data.messages || [],
      movements: [{ from_stage: null, to_stage: data.stage || 'Leads de Entrada', moved_at: now }]
    };
    leads.push(lead);
    saveToLocalStorage();
    sendAutomationToN8n('lead_created', lead);
    return lead;
  }

  // Supabase
  const payload = {
    name: data.name,
    phone: normalizePhone(data.phone),
    course_interest: data.course_interest || '',
    source: data.source || 'WhatsApp',
    stage: data.stage || 'Leads de Entrada',
    status: data.status || 'Novo',
    responsible: data.responsible || 'Lucas',
    notes: data.notes || '',
    last_message: data.last_message || '',
    last_interaction: now,
  };

  const { data: insertedLead, error } = await supabaseClient
    .from('leads')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar lead no Supabase:', error);
    showToast('Erro ao criar lead.', 'error');
    return null;
  }

  // Mensagem inicial
  if (data.last_message) {
    await supabaseClient.from('lead_messages').insert({
      lead_id: insertedLead.id,
      phone: insertedLead.phone,
      direction: 'in',
      message: data.last_message,
      channel: 'whatsapp',
      received_at: now,
    });
  }

  // Tags
  if (data.tags && data.tags.length > 0) {
    await supabaseClient.from('lead_tags').insert(
      data.tags.map(tag => ({ lead_id: insertedLead.id, tag }))
    );
  }

  // Movimento inicial
  await supabaseClient.from('lead_movements').insert({
    lead_id: insertedLead.id,
    from_stage: null,
    to_stage: insertedLead.stage,
  });

  sendAutomationToN8n('lead_created', insertedLead);
  await loadFromSupabase();
  return insertedLead;
}

// ============================================================
// EDITAR LEAD
// ============================================================

function editLead(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  openModal(lead);
}

// ============================================================
// EXCLUIR LEAD
// ============================================================

async function deleteLead(id) {
  if (!confirm('Excluir este lead permanentemente?')) return;

  if (SUPABASE_CONFIGURED) {
    const { error } = await supabaseClient.from('leads').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir lead.', 'error'); return; }
    await loadFromSupabase();
  } else {
    leads = leads.filter(l => l.id !== id);
    saveToLocalStorage();
    renderLeads();
  }

  if (currentDetailLeadId === id) closeDetails();
  showToast('Lead excluído.', 'warning');
}

// ============================================================
// ATUALIZAR ETAPA (drag & drop)
// ============================================================

async function updateLeadStage(id, newStage) {
  const lead = leads.find(l => l.id === id);
  if (!lead || lead.stage === newStage) return;

  const oldStage = lead.stage;
  const now = new Date().toISOString();

  if (SUPABASE_CONFIGURED) {
    const { error } = await supabaseClient
      .from('leads')
      .update({ stage: newStage, last_interaction: now, updated_at: now })
      .eq('id', id);

    if (error) { showToast('Erro ao mover lead.', 'error'); return; }

    await supabaseClient.from('lead_movements').insert({
      lead_id: id,
      from_stage: oldStage,
      to_stage: newStage,
    });

    await loadFromSupabase();
  } else {
    lead.stage = newStage;
    lead.last_interaction = now;
    registerLeadMovement(lead, oldStage, newStage);
    saveToLocalStorage();
    renderLeads();
  }

  const eventMap = {
    'Primeiro Contato':       'lead_stage_changed',
    'Documentação/Matrícula': 'lead_moved_to_documentation',
    'Aguardando Pagamento':   'lead_waiting_payment',
    'Matriculado':            'lead_converted',
  };
  sendAutomationToN8n(eventMap[newStage] || 'lead_stage_changed', { ...lead, stage: newStage });
  showToast(`Lead movido para "${newStage}"`, 'success');
}

// ============================================================
// RECEBER LEAD DO N8N (via Supabase ou local)
// ============================================================

async function receiveLeadFromN8n(payload) {
  const phone = normalizePhone(payload.phone);
  const now   = new Date().toISOString();

  if (SUPABASE_CONFIGURED) {
    const { data: existingLead, error: searchError } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (searchError) { console.error('Erro ao buscar lead:', searchError); return; }

    if (existingLead) {
      await supabaseClient.from('leads').update({
        last_message: payload.message,
        last_interaction: now,
        status: 'Novo',
        updated_at: now,
      }).eq('id', existingLead.id);

      await supabaseClient.from('lead_messages').insert({
        lead_id: existingLead.id,
        phone,
        direction: 'in',
        message: payload.message,
        channel: 'whatsapp',
        received_at: payload.received_at || now,
      });

      // Adiciona tag WhatsApp se não existir
      const { data: existingTags } = await supabaseClient
        .from('lead_tags').select('*').eq('lead_id', existingLead.id).eq('tag', 'WhatsApp');
      if (!existingTags || existingTags.length === 0) {
        await supabaseClient.from('lead_tags').insert({ lead_id: existingLead.id, tag: 'WhatsApp' });
      }

      showToast(`Lead "${existingLead.name}" atualizado com nova mensagem!`, 'success');
      await loadFromSupabase();
    } else {
      await createLead({
        name: payload.name || 'Lead WhatsApp',
        phone,
        course_interest: payload.course_interest || '',
        source: payload.source || 'WhatsApp',
        stage: 'Leads de Entrada',
        status: 'Novo',
        responsible: 'Lucas',
        last_message: payload.message,
        tags: ['WhatsApp'],
      });
      showToast('Novo lead recebido via WhatsApp!', 'success');
    }
  } else {
    // Fallback local
    const existing = leads.find(l => l.phone === phone);
    if (existing) {
      addLeadMessage(existing, payload.message, 'in');
      existing.last_interaction = now;
      existing.status = 'Novo';
      if (!existing.tags.includes('WhatsApp')) existing.tags.push('WhatsApp');
      saveToLocalStorage();
      renderLeads();
      showToast(`Lead "${existing.name}" atualizado com nova mensagem!`, 'success');
    } else {
      await createLead({
        name: payload.name || 'Lead WhatsApp',
        phone,
        course_interest: payload.course_interest || '',
        source: payload.source || 'WhatsApp',
        stage: 'Leads de Entrada',
        status: 'Novo',
        responsible: 'Lucas',
        last_message: payload.message,
        tags: ['WhatsApp'],
        messages: [{ text: payload.message, direction: 'in', received_at: payload.received_at || now }],
      });
      renderLeads();
      showToast('Novo lead recebido via WhatsApp!', 'success');
    }
  }
}

// ============================================================
// HELPERS LOCAIS
// ============================================================

function registerLeadMovement(lead, fromStage, toStage) {
  if (!lead.movements) lead.movements = [];
  lead.movements.push({ from_stage: fromStage, to_stage: toStage, moved_at: new Date().toISOString() });
}

function addLeadMessage(lead, text, direction = 'in') {
  if (!lead.messages) lead.messages = [];
  lead.messages.push({ text, direction, received_at: new Date().toISOString() });
  lead.last_message = text;
  lead.last_interaction = new Date().toISOString();
}

// ============================================================
// AUTOMAÇÃO N8N
// ============================================================

async function sendAutomationToN8n(eventName, lead) {
  const payload = prepareN8nPayload(eventName, lead);
  console.log('[n8n] Evento:', eventName, payload);

  if (!N8N_CONFIGURED) return;

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (SUPABASE_CONFIGURED && lead.id) {
      await supabaseClient.from('automation_logs').insert({
        lead_id: lead.id,
        automation_name: 'n8n',
        trigger_event: eventName,
        payload,
        status: response.ok ? 'sent' : 'error',
      });
    }
  } catch (err) {
    console.error('[n8n] Erro ao enviar webhook:', err);
    if (SUPABASE_CONFIGURED && lead.id) {
      await supabaseClient.from('automation_logs').insert({
        lead_id: lead.id,
        automation_name: 'n8n',
        trigger_event: eventName,
        payload,
        status: 'error',
      });
    }
  }
}

function prepareN8nPayload(eventName, lead) {
  return {
    event: eventName,
    timestamp: new Date().toISOString(),
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      course_interest: lead.course_interest,
      source: lead.source,
      stage: lead.stage,
      status: lead.status,
      responsible: lead.responsible,
      last_message: lead.last_message,
    },
  };
}

function triggerAutomation(eventName, lead) {
  sendAutomationToN8n(eventName, lead);
}

// ============================================================
// SIMULAR WHATSAPP
// ============================================================

const WHATSAPP_MESSAGES = [
  'Olá, tenho interesse no curso de Técnico em Segurança do Trabalho.',
  'Oi! Vi o anúncio e quero saber mais sobre o Técnico em Enfermagem.',
  'Bom dia! Quero informações sobre o Técnico em Informática.',
  'Olá, tenho interesse em me matricular no Técnico em Administração.',
  'Oi, podem me falar sobre o curso de Técnico em Contabilidade?',
  'Olá! Quais são os valores para o Técnico em Eletrotécnica?',
  'Tenho interesse no curso técnico. Podem me ajudar?',
  'Vi que vocês oferecem bolsas. Como funciona?',
];
const FAKE_NAMES   = ['Gabriel Moura','Isabela Nunes','Thiago Araújo','Letícia Pinto','Rodrigo Campos','Sabrina Faria','Eduardo Lima','Priscila Castro'];
const FAKE_COURSES = ['Técnico em Segurança do Trabalho','Técnico em Enfermagem','Técnico em Informática','Técnico em Administração','Técnico em Eletrotécnica','Técnico em Contabilidade','Técnico em Meio Ambiente'];

async function simulateWhatsAppLead() {
  const phone  = '419' + Math.floor(10000000 + Math.random() * 90000000);
  const msg    = WHATSAPP_MESSAGES[Math.floor(Math.random() * WHATSAPP_MESSAGES.length)];
  const name   = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  const course = FAKE_COURSES[Math.floor(Math.random() * FAKE_COURSES.length)];

  await receiveLeadFromN8n({
    name,
    phone,
    message: msg,
    course_interest: course,
    source: 'WhatsApp',
    received_at: new Date().toISOString(),
  });
}

// ============================================================
// MÉTRICAS
// ============================================================

function calculateMetrics() {
  const total              = leads.length;
  const matriculados       = leads.filter(l => l.stage === 'Matriculado').length;
  const conversao          = total > 0 ? Math.round((matriculados / total) * 100) : 0;
  const hoje               = new Date().toISOString().slice(0, 10);
  const novosHoje          = leads.filter(l => l.created_at && l.created_at.slice(0, 10) === hoje).length;
  const emAtendimento      = leads.filter(l => l.stage === 'Em Atendimento').length;
  const aguardandoPagamento = leads.filter(l => l.stage === 'Aguardando Pagamento').length;
  const semResposta        = leads.filter(l => l.status === 'Sem resposta').length;

  document.getElementById('totalLeads').textContent      = total;
  document.getElementById('totalMatriculados').textContent = matriculados;
  document.getElementById('taxaConversao').textContent   = conversao + '%';
  document.getElementById('m_total').textContent         = total;
  document.getElementById('m_hoje').textContent          = novosHoje;
  document.getElementById('m_atendimento').textContent   = emAtendimento;
  document.getElementById('m_pagamento').textContent     = aguardandoPagamento;
  document.getElementById('m_matriculados').textContent  = matriculados;
  document.getElementById('m_sem_resposta').textContent  = semResposta;
  document.getElementById('m_conversao').textContent     = conversao + '%';
}

// ============================================================
// FILTROS
// ============================================================

function getFilteredLeads() {
  const { search, origin, responsible, status } = activeFilters;
  return leads.filter(l => {
    const matchSearch      = !search      || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search) || (l.course_interest || '').toLowerCase().includes(search.toLowerCase());
    const matchOrigin      = !origin      || l.source === origin;
    const matchResponsible = !responsible || l.responsible === responsible;
    const matchStatus      = !status      || l.status === status;
    return matchSearch && matchOrigin && matchResponsible && matchStatus;
  });
}

function searchLeads() {
  activeFilters.search = document.getElementById('searchInput').value;
  renderLeads();
}

function filterLeads() {
  activeFilters.origin      = document.getElementById('filterOrigin').value;
  activeFilters.responsible = document.getElementById('filterResponsible').value;
  activeFilters.status      = document.getElementById('filterStatus').value;
  renderLeads();
}

// ============================================================
// RENDER KANBAN
// ============================================================

function renderLeads() {
  const board    = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  const filtered = getFilteredLeads();

  STAGES.forEach(stage => {
    const stageLeads    = filtered.filter(l => l.stage === stage.id);
    const allStageLeads = leads.filter(l => l.stage === stage.id);

    const col = document.createElement('div');
    col.className    = `kanban-col ${stage.colorClass}`;
    col.dataset.stage = stage.id;
    col.innerHTML = `
      <div class="col-header">
        <div class="col-title-row">
          <div class="col-title">
            <span class="col-dot"></span>
            ${stage.icon} ${stage.id}
          </div>
          <span class="col-count">${allStageLeads.length}</span>
        </div>
        <div class="col-meta">${stageLeads.length} lead${stageLeads.length !== 1 ? 's' : ''} exibido${stageLeads.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="col-body" data-stage="${stage.id}"></div>
    `;
    board.appendChild(col);

    const body = col.querySelector('.col-body');
    if (stageLeads.length === 0) {
      body.innerHTML = `<div class="col-empty"><div class="col-empty-icon">📭</div>Nenhum lead aqui</div>`;
    } else {
      stageLeads.forEach(lead => body.appendChild(createLeadCard(lead)));
    }
    setupDropZone(body);
  });

  calculateMetrics();
}

// ============================================================
// CARD DO LEAD
// ============================================================

function createLeadCard(lead) {
  const card = document.createElement('div');
  card.className    = 'lead-card';
  card.dataset.id   = lead.id;
  card.draggable    = true;

  const statusClass = 'status-' + (lead.status || 'Novo').replace(/ /g, '-');
  const tags        = (lead.tags || []).map(t => `<span class="tag tag-${t.replace(/ /g,'')}">${t}</span>`).join('');
  const initials    = getInitials(lead.responsible || 'ND');

  card.innerHTML = `
    <div class="card-top">
      <span class="card-name">${lead.name}</span>
      <span class="card-status ${statusClass}">${lead.status || 'Novo'}</span>
    </div>
    <div class="card-info">
      <div class="card-row">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 12 18.74a19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.91 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.91 8.7a16 16 0 0 0 5.39 5.39l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        ${lead.phone}
      </div>
      <div class="card-row">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
        ${lead.course_interest || '—'}
      </div>
      <div class="card-row">
        <span class="avatar" style="width:14px;height:14px;font-size:7px">${initials}</span>
        ${lead.responsible || '—'} · ${lead.source || '—'}
      </div>
    </div>
    ${lead.last_message ? `<div class="card-msg">"${lead.last_message}"</div>` : ''}
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
    <div class="card-footer">
      <span class="card-date">${formatDateShort(lead.last_interaction)}</span>
      <div class="card-actions">
        <button class="card-btn" title="Ver detalhes" onclick="openLeadDetails('${lead.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button class="card-btn edit" title="Editar" onclick="editLead('${lead.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-btn wpp" title="WhatsApp" onclick="openWhatsApp('${lead.phone}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>
        <button class="card-btn del" title="Excluir" onclick="deleteLead('${lead.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
  `;

  card.addEventListener('dragstart', e => {
    draggedLeadId = lead.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedLeadId = null;
  });

  return card;
}

// ============================================================
// DRAG & DROP
// ============================================================

function setupDropZone(el) {
  el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', ()  => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (!draggedLeadId) return;
    updateLeadStage(draggedLeadId, el.dataset.stage);
  });
}

// ============================================================
// ABRIR WHATSAPP
// ============================================================

function openWhatsApp(phone) {
  const clean = normalizePhone(phone);
  window.open(`https://wa.me/55${clean}`, '_blank');
}

// ============================================================
// MODAL ADD/EDIT
// ============================================================

function openModal(lead = null) {
  document.getElementById('modalTitle').textContent    = lead ? 'Editar Lead' : 'Novo Lead';
  document.getElementById('leadId').value              = lead ? lead.id : '';
  document.getElementById('fName').value               = lead ? lead.name : '';
  document.getElementById('fPhone').value              = lead ? lead.phone : '';
  document.getElementById('fCourse').value             = lead ? lead.course_interest : '';
  document.getElementById('fOrigin').value             = lead ? lead.source : 'WhatsApp';
  document.getElementById('fResponsible').value        = lead ? lead.responsible : 'Ana Lima';
  document.getElementById('fStatus').value             = lead ? lead.status : 'Novo';
  document.getElementById('fStage').value              = lead ? lead.stage : 'Leads de Entrada';
  document.getElementById('fNotes').value              = lead ? lead.notes : '';
  document.getElementById('fLastMessage').value        = lead ? lead.last_message : '';

  selectedTags = lead ? [...(lead.tags || [])] : [];
  renderTagsSelect();
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('fName').focus();
}

function renderTagsSelect() {
  document.querySelectorAll('.tag-toggle').forEach(btn => {
    btn.classList.toggle('active', selectedTags.includes(btn.dataset.tag));
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function saveModal() {
  const name  = document.getElementById('fName').value.trim();
  const phone = normalizePhone(document.getElementById('fPhone').value.trim());
  if (!name || !phone) { showToast('Nome e telefone são obrigatórios.', 'error'); return; }

  const id   = document.getElementById('leadId').value;
  const data = {
    name,
    phone,
    course_interest: document.getElementById('fCourse').value.trim(),
    source:      document.getElementById('fOrigin').value,
    responsible: document.getElementById('fResponsible').value,
    status:      document.getElementById('fStatus').value,
    stage:       document.getElementById('fStage').value,
    notes:       document.getElementById('fNotes').value.trim(),
    last_message: document.getElementById('fLastMessage').value.trim(),
    tags: [...selectedTags],
  };

  if (id) {
    // ---- EDITAR ----
    if (SUPABASE_CONFIGURED) {
      const lead    = leads.find(l => l.id === id);
      const oldStage = lead ? lead.stage : null;
      const now     = new Date().toISOString();

      const { error } = await supabaseClient
        .from('leads')
        .update({ ...data, last_interaction: now, updated_at: now })
        .eq('id', id);

      if (error) { showToast('Erro ao atualizar lead.', 'error'); return; }

      // Atualizar tags: apaga e recria
      await supabaseClient.from('lead_tags').delete().eq('lead_id', id);
      if (data.tags.length > 0) {
        await supabaseClient.from('lead_tags').insert(data.tags.map(tag => ({ lead_id: id, tag })));
      }

      if (oldStage && oldStage !== data.stage) {
        await supabaseClient.from('lead_movements').insert({
          lead_id: id, from_stage: oldStage, to_stage: data.stage,
        });
      }

      await loadFromSupabase();
    } else {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      const oldStage = lead.stage;
      Object.assign(lead, data);
      lead.last_interaction = new Date().toISOString();
      if (oldStage !== data.stage) registerLeadMovement(lead, oldStage, data.stage);
      saveToLocalStorage();
      renderLeads();
    }
    showToast(`Lead "${name}" atualizado.`, 'success');
  } else {
    // ---- CRIAR ----
    const exists = leads.find(l => l.phone === phone);
    if (exists) { showToast('Já existe um lead com este telefone.', 'warning'); return; }
    await createLead(data);
    showToast(`Lead "${name}" criado!`, 'success');
  }

  closeModal();
}

// ============================================================
// MODAL DETALHES
// ============================================================

function openLeadDetails(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  currentDetailLeadId = id;

  document.getElementById('detailName').textContent        = lead.name;
  document.getElementById('detailStage').textContent       = lead.stage;
  document.getElementById('dPhone').textContent            = lead.phone;
  document.getElementById('dCourse').textContent           = lead.course_interest || '—';
  document.getElementById('dOrigin').textContent           = lead.source || '—';
  document.getElementById('dResponsible').textContent      = lead.responsible || '—';
  document.getElementById('dStatus').textContent           = lead.status || '—';
  document.getElementById('dLastInteraction').textContent  = formatDate(lead.last_interaction);
  document.getElementById('dNotes').textContent            = lead.notes || 'Nenhuma observação.';
  document.getElementById('changeStatus').value            = '';

  document.getElementById('dTags').innerHTML =
    (lead.tags || []).map(t => `<span class="tag tag-${t.replace(/ /g,'')}">${t}</span>`).join('') ||
    '<span style="color:var(--muted);font-size:12px">Nenhuma tag</span>';

  const msgsEl = document.getElementById('dMessages');
  msgsEl.innerHTML = (!lead.messages || lead.messages.length === 0)
    ? '<div class="messages-empty">Nenhuma mensagem registrada.</div>'
    : lead.messages.map(m => `
        <div class="message-bubble">
          <div class="msg-text">${m.text}</div>
          <div class="msg-time">${formatDate(m.received_at)} · ${m.direction === 'in' ? '📩 Recebida' : '📤 Enviada'}</div>
        </div>`).join('');

  const movEl = document.getElementById('dMovements');
  movEl.innerHTML = (!lead.movements || lead.movements.length === 0)
    ? '<div class="messages-empty">Nenhuma movimentação.</div>'
    : [...lead.movements].reverse().map(m => `
        <div class="movement-item">
          <div class="movement-dot"></div>
          <div class="movement-info">
            <div class="movement-desc">
              ${m.from_stage ? `<strong>${m.from_stage}</strong> → ` : ''}<strong>${m.to_stage}</strong>
            </div>
            <div class="movement-time">${formatDate(m.moved_at)}</div>
          </div>
        </div>`).join('');

  document.getElementById('newObsInput').value = '';
  document.getElementById('detailsOverlay').classList.add('open');
}

function closeDetails() {
  document.getElementById('detailsOverlay').classList.remove('open');
  currentDetailLeadId = null;
}

// ============================================================
// DOMContentLoaded — INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // Carrega leads: Supabase se configurado, senão localStorage
  if (SUPABASE_CONFIGURED) {
    await loadFromSupabase();
    subscribeToLeadsRealtime();
  } else {
    console.warn('[CRM] Supabase não configurado. Usando localStorage.');
    showToast('Configure Supabase no script.js para habilitar sincronização.', 'warning');
    loadFromLocalStorage();
  }

  // ---- Botões principais ----
  document.getElementById('btnAddLead').addEventListener('click', () => openModal());
  document.getElementById('btnSimulate').addEventListener('click', simulateWhatsAppLead);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('saveModal').addEventListener('click', saveModal);
  document.getElementById('detailsClose').addEventListener('click', closeDetails);

  // Fechar ao clicar fora
  document.getElementById('modalOverlay').addEventListener('click',   e => { if (e.target === document.getElementById('modalOverlay'))   closeModal(); });
  document.getElementById('detailsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('detailsOverlay')) closeDetails(); });

  // Busca e filtros
  document.getElementById('searchInput').addEventListener('input', searchLeads);
  document.getElementById('filterOrigin').addEventListener('change', filterLeads);
  document.getElementById('filterResponsible').addEventListener('change', filterLeads);
  document.getElementById('filterStatus').addEventListener('change', filterLeads);

  // Tags toggle
  document.querySelectorAll('.tag-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      selectedTags = selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag];
      btn.classList.toggle('active', selectedTags.includes(tag));
    });
  });

  // Adicionar observação
  document.getElementById('addObsBtn').addEventListener('click', async () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    const obs = document.getElementById('newObsInput').value.trim();
    if (!obs) return;
    const timestamp = new Date().toLocaleString('pt-BR');
    const newNotes  = (lead.notes ? lead.notes + '\n' : '') + `[${timestamp}] ${obs}`;

    if (SUPABASE_CONFIGURED) {
      await supabaseClient.from('leads').update({
        notes: newNotes,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', currentDetailLeadId);
      await loadFromSupabase();
    } else {
      lead.notes = newNotes;
      lead.last_interaction = new Date().toISOString();
      saveToLocalStorage();
      renderLeads();
    }

    document.getElementById('newObsInput').value = '';
    document.getElementById('dNotes').textContent = newNotes;
    showToast('Observação adicionada.', 'success');
  });

  // Abrir WhatsApp
  document.getElementById('openWhatsApp').addEventListener('click', () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (lead) openWhatsApp(lead.phone);
  });

  // Copiar telefone
  document.getElementById('copyPhone').addEventListener('click', () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    navigator.clipboard.writeText(lead.phone).then(() => showToast('Telefone copiado!', 'success'));
  });

  // Alterar status
  document.getElementById('changeStatus').addEventListener('change', async e => {
    if (!currentDetailLeadId || !e.target.value) return;
    const lead   = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    const status = e.target.value;
    const now    = new Date().toISOString();

    if (SUPABASE_CONFIGURED) {
      await supabaseClient.from('leads').update({ status, last_interaction: now, updated_at: now }).eq('id', currentDetailLeadId);
      await loadFromSupabase();
    } else {
      lead.status = status;
      lead.last_interaction = now;
      saveToLocalStorage();
      renderLeads();
    }

    document.getElementById('dStatus').textContent = status;
    if (status === 'Sem resposta') sendAutomationToN8n('lead_without_response', lead);
    showToast(`Status alterado para "${status}"`, 'success');
  });

  // ESC fecha modais
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetails(); }
  });
});

/*
 * ============================================================
 * FLUXO N8N + WHATSAPP (para referência de configuração)
 * ============================================================
 * 1. Cliente envia mensagem no WhatsApp
 * 2. WhatsApp Business Cloud API dispara webhook para o n8n
 * 3. n8n recebe pelo "WhatsApp Trigger" ou "Webhook Node"
 * 4. n8n normaliza o telefone (remove formatação)
 * 5. n8n consulta Supabase: SELECT * FROM leads WHERE phone = $phone
 * 6. Se NÃO existir → INSERT INTO leads (stage = 'Leads de Entrada')
 * 7. Se existir     → UPDATE leads SET last_message, last_interaction
 * 8. n8n insere a mensagem em lead_messages
 * 9. n8n insere tag 'WhatsApp' em lead_tags (se não existir)
 * 10. Supabase Realtime notifica o CRM → atualização automática
 *
 * Payload esperado do n8n:
 * {
 *   name: "Nome do contato",
 *   phone: "41999999999",
 *   message: "Olá, tenho interesse em um curso técnico",
 *   course_interest: "Técnico em Segurança do Trabalho",
 *   source: "WhatsApp",
 *   received_at: "2026-06-02T10:00:00"
 * }
 * ============================================================
 */
