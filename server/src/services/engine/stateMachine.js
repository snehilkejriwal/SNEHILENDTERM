// The case lifecycle. The server is the only place a status can change,
// and only along these edges, so the UI can never put a case in an impossible state.
//
//   draft ──confirm──► confirmed ──analyze──► letter_ready ──mark_sent──► awaiting_response
//     ▲                   │                      │   ▲                       │      │
//     └──────unlock───────┴────────unlock────────┘   └─────────escalate──────┘      │
//                                                                                    ▼
//                       (any open state) ──close──► closed        resolve ──► resolved
export const STATUSES = ['draft', 'confirmed', 'letter_ready', 'awaiting_response', 'resolved', 'closed'];
export const FINAL = new Set(['resolved', 'closed']);

const TRANSITIONS = {
  confirm: { from: ['draft'], to: 'confirmed' },
  unlock: { from: ['confirmed', 'letter_ready'], to: 'draft' },
  analyze: { from: ['confirmed', 'letter_ready'], to: 'letter_ready' },
  mark_sent: { from: ['letter_ready'], to: 'awaiting_response' },
  escalate: { from: ['awaiting_response'], to: 'letter_ready' },
  resolve: { from: ['awaiting_response', 'letter_ready'], to: 'resolved' },
  close: { from: ['draft', 'confirmed', 'letter_ready', 'awaiting_response'], to: 'closed' },
};

export const ACTIONS = Object.keys(TRANSITIONS);

export function canTransition(status, action) {
  const t = TRANSITIONS[action];
  return Boolean(t && t.from.includes(status));
}

export function nextStatus(status, action) {
  if (!canTransition(status, action)) return null;
  return TRANSITIONS[action].to;
}

// Actions the UI may offer for a case right now (business guards are applied on top in the controller).
export function availableActions(caseDoc) {
  return ACTIONS.filter((a) => canTransition(caseDoc.status, a)).filter((a) => {
    if (a === 'unlock') return caseDoc.stageIndex === 0 && (caseDoc.stageLog || []).length === 0;
    return true;
  });
}
