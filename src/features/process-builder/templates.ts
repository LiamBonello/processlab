import type { ProcessFlowEdge, ProcessFlowNode } from './process-builder.types';

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string;
  monthlyVolume: number;
  workdaysPerMonth: number;
  hoursPerDay: number;
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
}

function task(
  id: string,
  label: string,
  x: number,
  y: number,
  durationMinutes: number,
  workers: number,
  hourlyCost: number,
  variabilityPercent = 10,
): ProcessFlowNode {
  return {
    id,
    type: 'process',
    position: { x, y },
    data: {
      label,
      kind: 'task',
      durationMinutes,
      workers,
      hourlyCost,
      variabilityPercent,
    },
  };
}

function control(
  id: string,
  label: string,
  kind: 'start' | 'decision' | 'end',
  x: number,
  y: number,
): ProcessFlowNode {
  return {
    id,
    type: 'process',
    position: { x, y },
    data: {
      label,
      kind,
      durationMinutes: 0,
      workers: 0,
      hourlyCost: 0,
      variabilityPercent: 0,
    },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  probability?: number,
): ProcessFlowEdge {
  return {
    id,
    source,
    target,
    data: probability === undefined ? {} : { probability },
  };
}

export const blankProcessTemplate: ProcessTemplate = {
  id: 'blank-process',
  name: 'Blank process',
  description: 'A clean Start → Task → End workflow.',
  monthlyVolume: 500,
  workdaysPerMonth: 22,
  hoursPerDay: 8,
  nodes: [
    control('start', 'Process starts', 'start', 80, 220),
    task('task-1', 'First task', 390, 220, 5, 1, 25, 10),
    control('end', 'Process complete', 'end', 720, 220),
  ],
  edges: [
    edge('e1', 'start', 'task-1'),
    edge('e2', 'task-1', 'end'),
  ],
};

export const processTemplates: ProcessTemplate[] = [
  {
    id: 'invoice-processing',
    name: 'Invoice processing',
    description: 'Receive, verify, approve, enter and prepare invoices for payment.',
    monthlyVolume: 800,
    workdaysPerMonth: 22,
    hoursPerDay: 8,
    nodes: [
      control('start', 'Invoice received', 'start', 40, 220),
      task('check-invoice', 'Check invoice', 270, 220, 5, 2, 22, 15),
      control('needs-approval', 'Needs approval?', 'decision', 560, 220),
      task('manager-approval', 'Manager approval', 850, 80, 8, 1, 35, 20),
      task('enter-system', 'Enter into system', 1120, 220, 4, 1, 22, 10),
      task('payment', 'Prepare payment', 1410, 220, 3, 1, 24, 10),
      control('end', 'Ready for payment', 'end', 1710, 220),
    ],
    edges: [
      edge('e-start-check', 'start', 'check-invoice'),
      edge('e-check-decision', 'check-invoice', 'needs-approval'),
      edge('e-decision-approval', 'needs-approval', 'manager-approval', 0.35),
      edge('e-decision-enter', 'needs-approval', 'enter-system', 0.65),
      edge('e-approval-enter', 'manager-approval', 'enter-system'),
      edge('e-enter-payment', 'enter-system', 'payment'),
      edge('e-payment-end', 'payment', 'end'),
    ],
  },
  {
    id: 'customer-support',
    name: 'Customer support',
    description: 'Triage incoming requests, resolve standard cases and escalate complex ones.',
    monthlyVolume: 1200,
    workdaysPerMonth: 22,
    hoursPerDay: 8,
    nodes: [
      control('start', 'Request received', 'start', 40, 220),
      task('triage', 'Triage request', 270, 220, 4, 2, 20, 25),
      control('complex', 'Complex case?', 'decision', 560, 220),
      task('standard', 'Resolve standard case', 850, 320, 12, 4, 22, 35),
      task('specialist', 'Specialist investigation', 850, 90, 35, 2, 38, 40),
      task('response', 'Send response', 1160, 220, 3, 2, 20, 10),
      control('end', 'Case closed', 'end', 1450, 220),
    ],
    edges: [
      edge('e1', 'start', 'triage'),
      edge('e2', 'triage', 'complex'),
      edge('e3', 'complex', 'specialist', 0.2),
      edge('e4', 'complex', 'standard', 0.8),
      edge('e5', 'specialist', 'response'),
      edge('e6', 'standard', 'response'),
      edge('e7', 'response', 'end'),
    ],
  },
  {
    id: 'employee-onboarding',
    name: 'Employee onboarding',
    description: 'Coordinate HR, equipment and access setup before a new hire starts.',
    monthlyVolume: 35,
    workdaysPerMonth: 22,
    hoursPerDay: 8,
    nodes: [
      control('start', 'Offer accepted', 'start', 40, 220),
      task('hr', 'Prepare HR records', 270, 220, 25, 1, 28, 20),
      control('equipment-needed', 'Equipment needed?', 'decision', 570, 220),
      task('equipment', 'Prepare equipment', 860, 80, 45, 1, 26, 30),
      task('accounts', 'Create accounts', 860, 330, 30, 1, 30, 25),
      task('orientation', 'Schedule orientation', 1180, 220, 15, 1, 26, 20),
      control('end', 'Ready to start', 'end', 1470, 220),
    ],
    edges: [
      edge('e1', 'start', 'hr'),
      edge('e2', 'hr', 'equipment-needed'),
      edge('e3', 'equipment-needed', 'equipment', 0.75),
      edge('e4', 'equipment-needed', 'accounts', 0.25),
      edge('e5', 'equipment', 'accounts'),
      edge('e6', 'accounts', 'orientation'),
      edge('e7', 'orientation', 'end'),
    ],
  },
  {
    id: 'order-fulfilment',
    name: 'Order fulfilment',
    description: 'Pick, quality-check, pack and dispatch customer orders.',
    monthlyVolume: 2500,
    workdaysPerMonth: 22,
    hoursPerDay: 8,
    nodes: [
      control('start', 'Order confirmed', 'start', 40, 220),
      task('pick', 'Pick items', 280, 220, 6, 4, 19, 20),
      task('quality', 'Quality check', 570, 220, 3, 2, 21, 15),
      control('issue', 'Issue found?', 'decision', 850, 220),
      task('repack', 'Resolve issue', 1130, 80, 9, 1, 23, 30),
      task('pack', 'Pack order', 1130, 320, 5, 3, 19, 20),
      task('dispatch', 'Dispatch', 1450, 220, 3, 2, 21, 15),
      control('end', 'Order shipped', 'end', 1740, 220),
    ],
    edges: [
      edge('e1', 'start', 'pick'),
      edge('e2', 'pick', 'quality'),
      edge('e3', 'quality', 'issue'),
      edge('e4', 'issue', 'repack', 0.08),
      edge('e5', 'issue', 'pack', 0.92),
      edge('e6', 'repack', 'pack'),
      edge('e7', 'pack', 'dispatch'),
      edge('e8', 'dispatch', 'end'),
    ],
  },
];

export function cloneTemplate(template: ProcessTemplate) {
  return {
    ...template,
    nodes: template.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data },
    })),
    edges: template.edges.map((item) => ({
      ...item,
      data: { ...item.data },
    })),
  };
}
