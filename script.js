/**
 * ============================================================
 *  CRM UpLife — script.js
 *  MVP funcional com localStorage
 *  Preparado para integração futura com Supabase + n8n
 * ============================================================
 */

// ============================================================
// CONFIGURAÇÃO DAS ETAPAS DO FUNIL
// ============================================================

const STAGES = [
  { id: 'Leads de Entrada',      colorClass: 'col-entrada',    icon: '📥', color: '#3b82f6' },
  { id: 'Primeiro Contato',      colorClass: 'col-contato',    icon: '👋', color: '#8b5cf6' },
  { id: 'Interessado',           colorClass: 'col-interesse',  icon: '⭐', color: '#f59e0b' },
  { id: 'Em Atendimento',        colorClass: 'col-atendimento',icon: '📞', color: '#0ea5e9' },
  { id: 'Documentação/Matrícula',colorClass: 'col-doc',        icon: '📋', color: '#ec4899' },
  { id: 'Aguardando Pagamento',  colorClass: 'col-pagamento',  icon: '💳', color: '#f97316' },
  { id: 'Matriculado',           colorClass: 'col-matriculado',icon: '🎓', color: '#22c55e' },
];

const TAGS_ALL = ['Urgente','Retornar','Documentação','Pagamento','Bolsa','WhatsApp'];

// ============================================================
// ESTADO GLOBAL
// ============================================================

let leads = [];
let draggedLeadId = null;
let currentDetailLeadId = null;
let activeFilters = { search: '', origin: '', responsible: '', status: '' };

// ============================================================
// DADOS FAKE INICIAIS
// ============================================================

const FAKE_LEADS = [
  {
    id: 'lead_001',
    name: 'Mariana Costa',
    phone: '41991234001',
    course_interest: 'Técnico em Segurança do Trabalho',
    source: 'WhatsApp',
    stage: 'Leads de Entrada',
    status: 'Novo',
    responsible: 'Ana Lima',
    notes: 'Lead veio pelo status do Instagram. Perguntou sobre bolsas.',
    last_message: 'Olá! Tenho interesse no curso de Segurança do Trabalho, podem me informar os valores?',
    last_interaction: '2026-06-02T09:15:00',
    created_at: '2026-06-02T09:00:00',
    tags: ['WhatsApp'],
    messages: [
      { text: 'Olá! Tenho interesse no curso de Segurança do Trabalho, podem me informar os valores?', direction: 'in', received_at: '2026-06-02T09:15:00' }
    ],
    movements: [
      { from_stage: null, to_stage: 'Leads de Entrada', moved_at: '2026-06-02T09:00:00' }
    ]
  },
  {
    
  }
];

// ============================================================
// UTILITÁRIOS
// ============================================================

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
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${Math.floor(diff)}min atrás`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ============================================================
// LOCALSTORAGE
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
}

// ============================================================
// MÉTRICAS
// ============================================================

function calculateMetrics() {
  const total = leads.length;
  const matriculados = leads.filter(l => l.stage === 'Matriculado').length;
  const conversao = total > 0 ? Math.round((matriculados / total) * 100) : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const novosHoje = leads.filter(l => l.created_at && l.created_at.slice(0, 10) === hoje).length;
  const emAtendimento = leads.filter(l => l.stage === 'Em Atendimento').length;
  const aguardandoPagamento = leads.filter(l => l.stage === 'Aguardando Pagamento').length;
  const semResposta = leads.filter(l => l.status === 'Sem resposta').length;

  // Topbar
  document.getElementById('totalLeads').textContent = total;
  document.getElementById('totalMatriculados').textContent = matriculados;
  document.getElementById('taxaConversao').textContent = conversao + '%';

  // Metrics strip
  document.getElementById('m_total').textContent = total;
  document.getElementById('m_hoje').textContent = novosHoje;
  document.getElementById('m_atendimento').textContent = emAtendimento;
  document.getElementById('m_pagamento').textContent = aguardandoPagamento;
  document.getElementById('m_matriculados').textContent = matriculados;
  document.getElementById('m_sem_resposta').textContent = semResposta;
  document.getElementById('m_conversao').textContent = conversao + '%';
}

// ============================================================
// FILTROS
// ============================================================

function getFilteredLeads() {
  const { search, origin, responsible, status } = activeFilters;
  return leads.filter(l => {
    const matchSearch = !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      (l.course_interest || '').toLowerCase().includes(search.toLowerCase());
    const matchOrigin = !origin || l.source === origin;
    const matchResponsible = !responsible || l.responsible === responsible;
    const matchStatus = !status || l.status === status;
    return matchSearch && matchOrigin && matchResponsible && matchStatus;
  });
}

function searchLeads() {
  activeFilters.search = document.getElementById('searchInput').value;
  renderLeads();
}

function filterLeads() {
  activeFilters.origin = document.getElementById('filterOrigin').value;
  activeFilters.responsible = document.getElementById('filterResponsible').value;
  activeFilters.status = document.getElementById('filterStatus').value;
  renderLeads();
}

// ============================================================
// RENDER
// ============================================================

function renderLeads() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  const filtered = getFilteredLeads();

  STAGES.forEach(stage => {
    const stageLeads = filtered.filter(l => l.stage === stage.id);
    const allStageLeads = leads.filter(l => l.stage === stage.id);

    const col = document.createElement('div');
    col.className = `kanban-col ${stage.colorClass}`;
    col.dataset.stage = stage.id;

    // Column header
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
      stageLeads.forEach(lead => {
        body.appendChild(createLeadCard(lead));
      });
    }

    // Drag & Drop no col-body
    setupDropZone(body);
  });

  calculateMetrics();
}

// ============================================================
// LEAD CARD
// ============================================================

function createLeadCard(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card';
  card.dataset.id = lead.id;
  card.draggable = true;

  const statusClass = 'status-' + (lead.status || 'Novo').replace(/ /g, '-');
  const tags = (lead.tags || []).map(t => `<span class="tag tag-${t.replace(/ /g,'')}">${t}</span>`).join('');
  const initials = getInitials(lead.responsible || 'ND');

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
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="avatar" style="width:14px;height:14px;font-size:7px">${initials}</span>
        ${lead.responsible || '—'}
        &nbsp;·&nbsp;
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        ${lead.source || '—'}
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

  // Drag events
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
  el.addEventListener('dragover', e => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (!draggedLeadId) return;
    const newStage = el.dataset.stage;
    updateLeadStage(draggedLeadId, newStage);
  });
}

// ============================================================
// CRUD
// ============================================================

function createLead(data) {
  const now = new Date().toISOString();
  const lead = {
    id: generateId(),
    name: data.name,
    phone: data.phone,
    course_interest: data.course_interest || '',
    source: data.source || 'WhatsApp',
    stage: data.stage || 'Leads de Entrada',
    status: data.status || 'Novo',
    responsible: data.responsible || 'Ana Lima',
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

function editLead(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  openModal(lead);
}

function deleteLead(id) {
  if (!confirm('Excluir este lead permanentemente?')) return;
  leads = leads.filter(l => l.id !== id);
  saveToLocalStorage();
  renderLeads();
  if (currentDetailLeadId === id) closeDetails();
  showToast('Lead excluído.', 'warning');
}

function updateLeadStage(id, newStage) {
  const lead = leads.find(l => l.id === id);
  if (!lead || lead.stage === newStage) return;
  const oldStage = lead.stage;
  lead.stage = newStage;
  lead.last_interaction = new Date().toISOString();
  registerLeadMovement(lead, oldStage, newStage);
  saveToLocalStorage();
  renderLeads();

  // Dispara eventos de automação conforme a etapa
  const eventMap = {
    'Primeiro Contato': 'lead_stage_changed',
    'Documentação/Matrícula': 'lead_moved_to_documentation',
    'Aguardando Pagamento': 'lead_waiting_payment',
    'Matriculado': 'lead_converted',
  };
  const event = eventMap[newStage] || 'lead_stage_changed';
  sendAutomationToN8n(event, lead);

  showToast(`Lead movido para "${newStage}"`, 'success');
}

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
// ABRIR WHATSAPP
// ============================================================

function openWhatsApp(phone) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/55${clean}`, '_blank');
}

// ============================================================
// MODAL ADD/EDIT
// ============================================================

let selectedTags = [];

function openModal(lead = null) {
  document.getElementById('modalTitle').textContent = lead ? 'Editar Lead' : 'Novo Lead';
  document.getElementById('leadId').value = lead ? lead.id : '';
  document.getElementById('fName').value = lead ? lead.name : '';
  document.getElementById('fPhone').value = lead ? lead.phone : '';
  document.getElementById('fCourse').value = lead ? lead.course_interest : '';
  document.getElementById('fOrigin').value = lead ? lead.source : 'WhatsApp';
  document.getElementById('fResponsible').value = lead ? lead.responsible : 'Ana Lima';
  document.getElementById('fStatus').value = lead ? lead.status : 'Novo';
  document.getElementById('fStage').value = lead ? lead.stage : 'Leads de Entrada';
  document.getElementById('fNotes').value = lead ? lead.notes : '';
  document.getElementById('fLastMessage').value = lead ? lead.last_message : '';

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

function saveModal() {
  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  if (!name || !phone) { showToast('Nome e telefone são obrigatórios.', 'error'); return; }

  const id = document.getElementById('leadId').value;
  const data = {
    name,
    phone,
    course_interest: document.getElementById('fCourse').value.trim(),
    source: document.getElementById('fOrigin').value,
    responsible: document.getElementById('fResponsible').value,
    status: document.getElementById('fStatus').value,
    stage: document.getElementById('fStage').value,
    notes: document.getElementById('fNotes').value.trim(),
    last_message: document.getElementById('fLastMessage').value.trim(),
    tags: [...selectedTags],
  };

  if (id) {
    // Editar
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    const oldStage = lead.stage;
    Object.assign(lead, data);
    lead.last_interaction = new Date().toISOString();
    if (oldStage !== data.stage) registerLeadMovement(lead, oldStage, data.stage);
    showToast(`Lead "${name}" atualizado.`, 'success');
  } else {
    // Verificar duplicado
    const exists = leads.find(l => l.phone === phone);
    if (exists) { showToast('Já existe um lead com este telefone.', 'warning'); return; }
    createLead(data);
    showToast(`Lead "${name}" criado!`, 'success');
  }

  saveToLocalStorage();
  renderLeads();
  closeModal();
}

// ============================================================
// MODAL DETALHES
// ============================================================

function openLeadDetails(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  currentDetailLeadId = id;

  document.getElementById('detailName').textContent = lead.name;
  document.getElementById('detailStage').textContent = lead.stage;
  document.getElementById('dPhone').textContent = lead.phone;
  document.getElementById('dCourse').textContent = lead.course_interest || '—';
  document.getElementById('dOrigin').textContent = lead.source || '—';
  document.getElementById('dResponsible').textContent = lead.responsible || '—';
  document.getElementById('dStatus').textContent = lead.status || '—';
  document.getElementById('dLastInteraction').textContent = formatDate(lead.last_interaction);
  document.getElementById('dNotes').textContent = lead.notes || 'Nenhuma observação.';
  document.getElementById('changeStatus').value = '';

  // Tags
  const tagsEl = document.getElementById('dTags');
  tagsEl.innerHTML = (lead.tags || []).map(t => `<span class="tag tag-${t.replace(/ /g,'')}">${t}</span>`).join('') || '<span style="color:var(--muted);font-size:12px">Nenhuma tag</span>';

  // Mensagens
  const msgsEl = document.getElementById('dMessages');
  if (!lead.messages || lead.messages.length === 0) {
    msgsEl.innerHTML = '<div class="messages-empty">Nenhuma mensagem registrada.</div>';
  } else {
    msgsEl.innerHTML = lead.messages.map(m => `
      <div class="message-bubble">
        <div class="msg-text">${m.text}</div>
        <div class="msg-time">${formatDate(m.received_at)} · ${m.direction === 'in' ? '📩 Recebida' : '📤 Enviada'}</div>
      </div>
    `).join('');
  }

  // Movimentos
  const movEl = document.getElementById('dMovements');
  if (!lead.movements || lead.movements.length === 0) {
    movEl.innerHTML = '<div class="messages-empty">Nenhuma movimentação.</div>';
  } else {
    movEl.innerHTML = [...lead.movements].reverse().map(m => `
      <div class="movement-item">
        <div class="movement-dot"></div>
        <div class="movement-info">
          <div class="movement-desc">
            ${m.from_stage ? `<strong>${m.from_stage}</strong> → ` : ''}<strong>${m.to_stage}</strong>
          </div>
          <div class="movement-time">${formatDate(m.moved_at)}</div>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('newObsInput').value = '';
  document.getElementById('detailsOverlay').classList.add('open');
}

function closeDetails() {
  document.getElementById('detailsOverlay').classList.remove('open');
  currentDetailLeadId = null;
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

const FAKE_NAMES = ['Gabriel Moura', 'Isabela Nunes', 'Thiago Araújo', 'Letícia Pinto', 'Rodrigo Campos', 'Sabrina Faria', 'Eduardo Lima', 'Priscila Castro'];
const FAKE_COURSES = ['Técnico em Segurança do Trabalho', 'Técnico em Enfermagem', 'Técnico em Informática', 'Técnico em Administração', 'Técnico em Eletrotécnica', 'Técnico em Contabilidade', 'Técnico em Meio Ambiente'];

function simulateWhatsAppLead() {
  const phone = '419' + Math.floor(10000000 + Math.random() * 90000000);
  const msg = WHATSAPP_MESSAGES[Math.floor(Math.random() * WHATSAPP_MESSAGES.length)];
  const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  const course = FAKE_COURSES[Math.floor(Math.random() * FAKE_COURSES.length)];

  receiveLeadFromN8n({
    name,
    phone,
    message: msg,
    course_interest: course,
    source: 'WhatsApp',
    received_at: new Date().toISOString()
  });
}

// ============================================================
// RECEBER LEAD DO N8N (simulação)
// ============================================================

function receiveLeadFromN8n(payload) {
  const existing = leads.find(l => l.phone === payload.phone);
  if (existing) {
    addLeadMessage(existing, payload.message, 'in');
    existing.last_interaction = new Date().toISOString();
    existing.status = 'Novo';
    if (!existing.tags.includes('WhatsApp')) existing.tags.push('WhatsApp');
    saveToLocalStorage();
    renderLeads();
    showToast(`Lead existente "${existing.name}" atualizado com nova mensagem!`, 'success');
  } else {
    const lead = createLead({
      name: payload.name,
      phone: payload.phone,
      course_interest: payload.course_interest || '',
      source: payload.source || 'WhatsApp',
      stage: 'Leads de Entrada',
      status: 'Novo',
      responsible: 'Ana Lima',
      last_message: payload.message,
      tags: ['WhatsApp'],
      messages: [{ text: payload.message, direction: 'in', received_at: payload.received_at || new Date().toISOString() }],
    });
    renderLeads();
    showToast(`Novo lead "${lead.name}" recebido via WhatsApp!`, 'success');
  }
}

// ============================================================
// EVENTOS DE UI
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  renderLeads();

  // Botões principais
  document.getElementById('btnAddLead').addEventListener('click', () => openModal());
  document.getElementById('btnSimulate').addEventListener('click', simulateWhatsAppLead);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('saveModal').addEventListener('click', saveModal);
  document.getElementById('detailsClose').addEventListener('click', closeDetails);

  // Fechar modal ao clicar fora
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === document.getElementById('modalOverlay')) closeModal(); });
  document.getElementById('detailsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('detailsOverlay')) closeDetails(); });

  // Busca e filtros
  document.getElementById('searchInput').addEventListener('input', searchLeads);
  document.getElementById('filterOrigin').addEventListener('change', filterLeads);
  document.getElementById('filterResponsible').addEventListener('change', filterLeads);
  document.getElementById('filterStatus').addEventListener('change', filterLeads);

  // Tags toggle no modal
  document.querySelectorAll('.tag-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
      } else {
        selectedTags.push(tag);
      }
      btn.classList.toggle('active', selectedTags.includes(tag));
    });
  });

  // Detalhes: adicionar observação
  document.getElementById('addObsBtn').addEventListener('click', () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    const obs = document.getElementById('newObsInput').value.trim();
    if (!obs) return;
    const timestamp = new Date().toLocaleString('pt-BR');
    lead.notes = (lead.notes ? lead.notes + '\n' : '') + `[${timestamp}] ${obs}`;
    lead.last_interaction = new Date().toISOString();
    document.getElementById('newObsInput').value = '';
    document.getElementById('dNotes').textContent = lead.notes;
    saveToLocalStorage();
    renderLeads();
    showToast('Observação adicionada.', 'success');
  });

  // Detalhes: abrir WhatsApp
  document.getElementById('openWhatsApp').addEventListener('click', () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (lead) openWhatsApp(lead.phone);
  });

  // Detalhes: copiar telefone
  document.getElementById('copyPhone').addEventListener('click', () => {
    if (!currentDetailLeadId) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    navigator.clipboard.writeText(lead.phone).then(() => showToast('Telefone copiado!', 'success'));
  });

  // Detalhes: alterar status
  document.getElementById('changeStatus').addEventListener('change', e => {
    if (!currentDetailLeadId || !e.target.value) return;
    const lead = leads.find(l => l.id === currentDetailLeadId);
    if (!lead) return;
    lead.status = e.target.value;
    lead.last_interaction = new Date().toISOString();
    saveToLocalStorage();
    renderLeads();
    document.getElementById('dStatus').textContent = lead.status;
    if (lead.status === 'Sem resposta') sendAutomationToN8n('lead_without_response', lead);
    showToast(`Status alterado para "${lead.status}"`, 'success');
  });

  // ESC fecha modais
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetails(); }
  });
});

// ============================================================
// FUTURA INTEGRAÇÃO COM N8N + WHATSAPP
// ============================================================
/*
  FLUXO FUTURO DE INTEGRAÇÃO:
  ─────────────────────────────────────────────────────────────
  1. Cliente envia mensagem no WhatsApp
  2. WhatsApp Business Cloud API dispara um webhook para o n8n
  3. n8n recebe o webhook pelo "WhatsApp Trigger" ou "Webhook Node"
  4. n8n trata os dados recebidos (nome, telefone, mensagem)
  5. n8n verifica se o número já existe no Supabase:
       SELECT * FROM leads WHERE phone = $phone
  6. Se NÃO existir → n8n cria um novo lead no Supabase:
       INSERT INTO leads (name, phone, source, stage, status, ...) VALUES (...)
  7. Se JÁ existir → n8n atualiza o lead:
       UPDATE leads SET last_message = $msg, last_interaction = now() WHERE phone = $phone
  8. n8n salva a mensagem na tabela lead_messages
  9. Supabase Realtime notifica o CRM → lead aparece automaticamente sem refresh
  ─────────────────────────────────────────────────────────────
*/

function sendAutomationToN8n(eventName, lead) {
  const payload = prepareN8nPayload(eventName, lead);
  console.log('[n8n Automation] Evento:', eventName, '| Payload:', payload);

  /*
  // DESCOMENTE PARA INTEGRAÇÃO REAL COM N8N:
  fetch("https://SEU-N8N.cloud/webhook/up-life-crm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(data => console.log('[n8n] Resposta:', data))
  .catch(err => console.error('[n8n] Erro:', err));
  */
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
    }
  };
}

function triggerAutomation(eventName, lead) {
  sendAutomationToN8n(eventName, lead);
}

// ============================================================
// FUTURA INTEGRAÇÃO COM SUPABASE
// ============================================================
/*
  ESTRUTURA DO BANCO DE DADOS:
  ─────────────────────────────────────────────────────────────
  create table leads (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text not null unique,
    course_interest text,
    source text,
    stage text not null,
    status text default 'Novo',
    responsible text,
    notes text,
    last_message text,
    last_interaction timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
  );
  create table lead_messages (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid references leads(id) on delete cascade,
    phone text not null,
    direction text,
    message text not null,
    channel text default 'whatsapp',
    received_at timestamp with time zone default now()
  );
  create table lead_movements (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid references leads(id) on delete cascade,
    from_stage text,
    to_stage text,
    moved_at timestamp with time zone default now()
  );
  create table automation_logs (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid references leads(id) on delete cascade,
    automation_name text,
    trigger_event text,
    payload jsonb,
    status text,
    created_at timestamp with time zone default now()
  );
  create table lead_tags (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid references leads(id) on delete cascade,
    tag text not null
  );
  ─────────────────────────────────────────────────────────────
*/

function prepareSupabasePayload(lead) {
  return {
    name: lead.name,
    phone: lead.phone,
    course_interest: lead.course_interest || null,
    source: lead.source || null,
    stage: lead.stage,
    status: lead.status || 'Novo',
    responsible: lead.responsible || null,
    notes: lead.notes || null,
    last_message: lead.last_message || null,
    last_interaction: lead.last_interaction || new Date().toISOString(),
  };
}

/*
// FUNÇÕES SUPABASE — DESCOMENTE E CONFIGURE COM SUA URL/KEY

const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_KEY = "SUA-ANON-KEY";

async function supabaseInsertLead(lead) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(prepareSupabasePayload(lead))
  });
  return await res.json();
}

async function supabaseUpdateLead(id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify(data)
  });
  return await res.json();
}

async function supabaseUpdateLeadStage(id, stage) {
  return await supabaseUpdateLead(id, { stage, updated_at: new Date().toISOString() });
}

async function supabaseFetchLeads() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?order=created_at.desc`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  return await res.json();
}

async function supabaseInsertMessage(leadId, phone, message, direction = 'in') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ lead_id: leadId, phone, message, direction, channel: 'whatsapp' })
  });
  return await res.json();
}

async function supabaseInsertMovement(leadId, fromStage, toStage) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_movements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ lead_id: leadId, from_stage: fromStage, to_stage: toStage })
  });
  return await res.json();
}

async function supabaseLogAutomation(leadId, automationName, triggerEvent, payload, status = 'sent') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/automation_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ lead_id: leadId, automation_name: automationName, trigger_event: triggerEvent, payload, status })
  });
  return await res.json();
}

// SUPABASE REALTIME (futuro — exige @supabase/supabase-js)
// supabase.channel('leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, payload => {
//   console.log('Realtime change:', payload);
//   loadFromSupabase(); // recarrega os leads
// }).subscribe();
*/
