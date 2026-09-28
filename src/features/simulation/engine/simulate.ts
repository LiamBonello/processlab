import type {
  ProcessConnection,
  ProcessStep,
  SimulationResult,
  SimulationSettings,
  SimulationTraceEvent,
  TaskSimulationMetric,
} from './types';

interface SimulationEvent {
  at: number;
  transactionId: number;
  stepId: string;
}

interface TaskAccumulator {
  visits: number;
  busyMinutes: number;
  queueMinutes: number;
  processingCost: number;
}

class MinHeap {
  private readonly items: SimulationEvent[] = [];

  get size() {
    return this.items.length;
  }

  push(event: SimulationEvent) {
    this.items.push(event);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): SimulationEvent | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return first;
  }

  private bubbleUp(index: number) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.items[parent].at <= this.items[current].at) break;
      [this.items[parent], this.items[current]] = [this.items[current], this.items[parent]];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;

    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (left < this.items.length && this.items[left].at < this.items[smallest].at) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right].at < this.items[smallest].at) {
        smallest = right;
      }
      if (smallest === current) break;

      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

const EPSILON = 1e-6;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function sampleDuration(
  baseMinutes: number,
  variabilityPercent: number,
  random: () => number,
) {
  if (variabilityPercent <= 0) return baseMinutes;

  const variability = variabilityPercent / 100;
  const triangularOffset = random() + random() - 1;
  return Math.max(0.1, baseMinutes * (1 + triangularOffset * variability));
}

function validateProcess(
  steps: ProcessStep[],
  connections: ProcessConnection[],
  settings: SimulationSettings,
) {
  if (steps.length === 0) throw new Error('Add at least one step before running a simulation.');

  assertPositiveFinite(settings.monthlyVolume, 'Monthly volume');
  assertPositiveFinite(settings.workdaysPerMonth, 'Workdays per month');
  assertPositiveFinite(settings.hoursPerDay, 'Hours per day');

  const stepIds = new Set<string>();
  const startSteps = steps.filter((step) => step.kind === 'start');
  const endSteps = steps.filter((step) => step.kind === 'end');

  if (startSteps.length !== 1) {
    throw new Error('The process must contain exactly one Start step.');
  }
  if (endSteps.length < 1) {
    throw new Error('The process must contain at least one End step.');
  }

  for (const step of steps) {
    if (!step.id.trim()) throw new Error('Every step requires an ID.');
    if (stepIds.has(step.id)) throw new Error(`Duplicate step ID: ${step.id}`);
    stepIds.add(step.id);

    if (step.kind === 'task') {
      const durationMinutes = step.durationMinutes ?? 0;
      const workers = step.workers ?? 0;
      const hourlyCost = step.hourlyCost ?? Number.NaN;
      const variabilityPercent = step.variabilityPercent ?? 0;

      assertPositiveFinite(durationMinutes, `${step.label} duration`);
      assertPositiveFinite(workers, `${step.label} workers`);

      if (!Number.isInteger(workers)) {
        throw new Error(`${step.label} workers must be a whole number.`);
      }
      if (!Number.isFinite(hourlyCost) || hourlyCost < 0) {
        throw new Error(`${step.label} hourly cost cannot be negative.`);
      }
      if (
        !Number.isFinite(variabilityPercent) ||
        variabilityPercent < 0 ||
        variabilityPercent > 100
      ) {
        throw new Error(`${step.label} variability must be between 0% and 100%.`);
      }
    }
  }

  const incoming = new Map(steps.map((step) => [step.id, 0]));
  const outgoing = new Map(steps.map((step) => [step.id, [] as ProcessConnection[]]));

  for (const connection of connections) {
    if (!stepIds.has(connection.source) || !stepIds.has(connection.target)) {
      throw new Error('A connection references a step that no longer exists.');
    }
    incoming.set(connection.target, (incoming.get(connection.target) ?? 0) + 1);
    outgoing.get(connection.source)?.push(connection);
  }

  const startStep = startSteps[0];
  if ((incoming.get(startStep.id) ?? 0) !== 0) {
    throw new Error('The Start step cannot have an incoming connection.');
  }

  for (const step of steps) {
    const incomingCount = incoming.get(step.id) ?? 0;
    const outgoingConnections = outgoing.get(step.id) ?? [];

    if (step.kind !== 'start' && incomingCount === 0) {
      throw new Error(`${step.label} is disconnected. Connect every step into the process.`);
    }

    if (step.kind === 'end') {
      if (outgoingConnections.length > 0) {
        throw new Error('End steps cannot have outgoing connections.');
      }
      continue;
    }

    if (outgoingConnections.length === 0) {
      throw new Error(`${step.label} needs an outgoing connection.`);
    }

    if (step.kind !== 'decision' && outgoingConnections.length > 1) {
      throw new Error(`${step.label} has multiple outgoing routes. Add a Decision step before branching.`);
    }

    if (step.kind === 'decision') {
      if (outgoingConnections.length < 2) {
        throw new Error(`${step.label} needs at least two branches.`);
      }

      const probabilities = outgoingConnections.map((connection) => connection.probability);
      if (probabilities.some((probability) => probability === undefined)) {
        throw new Error(`${step.label} requires a probability on every branch.`);
      }

      const total = probabilities.reduce((sum, probability) => sum + (probability ?? 0), 0);
      if (Math.abs(total - 1) > EPSILON) {
        throw new Error(`${step.label} branch probabilities must total 100%.`);
      }

      if (probabilities.some((probability) => (probability ?? 0) <= 0)) {
        throw new Error(`${step.label} branch probabilities must be greater than 0%.`);
      }
    }
  }

  const reachable = new Set<string>();
  const stack = [startStep.id];

  while (stack.length > 0) {
    const stepId = stack.pop();
    if (!stepId || reachable.has(stepId)) continue;
    reachable.add(stepId);

    for (const connection of outgoing.get(stepId) ?? []) {
      stack.push(connection.target);
    }
  }

  if (reachable.size !== steps.length) {
    throw new Error('Every step must be reachable from Start.');
  }

  const indegree = new Map(incoming);
  const topologicalQueue = steps
    .filter((step) => (indegree.get(step.id) ?? 0) === 0)
    .map((step) => step.id);
  let visited = 0;

  while (topologicalQueue.length > 0) {
    const stepId = topologicalQueue.shift();
    if (!stepId) continue;
    visited += 1;

    for (const connection of outgoing.get(stepId) ?? []) {
      const nextDegree = (indegree.get(connection.target) ?? 0) - 1;
      indegree.set(connection.target, nextDegree);
      if (nextDegree === 0) topologicalQueue.push(connection.target);
    }
  }

  if (visited !== steps.length) {
    throw new Error('Cycles are not supported yet. Remove the loop before running the simulation.');
  }

  return startStep.id;
}

function selectTraceTransactions(transactionCount: number, maxSamples = 24) {
  const sampleCount = Math.min(transactionCount, maxSamples);
  if (sampleCount <= 0) return [];

  if (sampleCount === 1) return [0];

  const ids = new Set<number>();
  for (let index = 0; index < sampleCount; index += 1) {
    ids.add(
      Math.round((index * (transactionCount - 1)) / (sampleCount - 1)),
    );
  }

  return [...ids].sort((a, b) => a - b);
}

function chooseNextConnection(
  outgoing: ProcessConnection[],
  random: () => number,
): ProcessConnection | undefined {
  if (outgoing.length === 0) return undefined;
  if (outgoing.length === 1) return outgoing[0];

  let cursor = random();
  for (const connection of outgoing) {
    cursor -= connection.probability ?? 0;
    if (cursor <= 0) return connection;
  }

  return outgoing[outgoing.length - 1];
}

export function simulateProcess(
  steps: ProcessStep[],
  connections: ProcessConnection[],
  settings: SimulationSettings,
): SimulationResult {
  const startStepId = validateProcess(steps, connections, settings);
  const transactionCount = Math.max(1, Math.floor(settings.monthlyVolume));
  const horizonMinutes = settings.workdaysPerMonth * settings.hoursPerDay * 60;
  const random = createSeededRandom(settings.seed ?? 20260928);

  const stepById = new Map(steps.map((step) => [step.id, step]));
  const outgoingByStep = new Map(steps.map((step) => [step.id, [] as ProcessConnection[]]));
  for (const connection of connections) {
    outgoingByStep.get(connection.source)?.push(connection);
  }

  const taskSteps = steps.filter((step) => step.kind === 'task');
  const routeVisits = new Map(
    connections.map((connection) => [
      `${connection.source}::${connection.target}`,
      0,
    ]),
  );

  const workerAvailability = new Map(
    taskSteps.map((step) => [
      step.id,
      Array.from({ length: step.workers ?? 1 }, () => 0),
    ]),
  );
  const taskAccumulators = new Map<string, TaskAccumulator>(
    taskSteps.map((step) => [
      step.id,
      { visits: 0, busyMinutes: 0, queueMinutes: 0, processingCost: 0 },
    ]),
  );

  const arrivals = Array.from({ length: transactionCount }, (_, index) => {
    const bucketSize = horizonMinutes / transactionCount;
    return index * bucketSize + random() * bucketSize;
  });

  const sampledTransactionIds = selectTraceTransactions(transactionCount);
  const sampledTransactionIdSet = new Set(sampledTransactionIds);
  const traceEvents: SimulationTraceEvent[] = [];

  const recordTrace = (event: SimulationTraceEvent) => {
    if (sampledTransactionIdSet.has(event.transactionId)) {
      traceEvents.push(event);
    }
  };

  const eventQueue = new MinHeap();
  arrivals.forEach((arrival, transactionId) => {
    eventQueue.push({ at: arrival, transactionId, stepId: startStepId });
    recordTrace({
      at: arrival,
      transactionId,
      kind: 'arrive',
      stepId: startStepId,
    });
  });

  const completionTimes = new Array<number>(transactionCount).fill(Number.NaN);
  let totalQueueMinutes = 0;

  while (eventQueue.size > 0) {
    const event = eventQueue.pop();
    if (!event) break;

    const step = stepById.get(event.stepId);
    if (!step) continue;

    if (step.kind === 'end') {
      completionTimes[event.transactionId] = event.at;
      recordTrace({
        at: event.at,
        transactionId: event.transactionId,
        kind: 'complete',
        stepId: step.id,
      });
      continue;
    }

    if (step.kind === 'start' || step.kind === 'decision') {
      const nextConnection = chooseNextConnection(
        outgoingByStep.get(step.id) ?? [],
        random,
      );
      if (nextConnection) {
        const routeKey = `${nextConnection.source}::${nextConnection.target}`;
        routeVisits.set(routeKey, (routeVisits.get(routeKey) ?? 0) + 1);
        recordTrace({
          at: event.at,
          transactionId: event.transactionId,
          kind: 'route',
          stepId: nextConnection.target,
          fromStepId: nextConnection.source,
          toStepId: nextConnection.target,
        });
        eventQueue.push({
          at: event.at,
          transactionId: event.transactionId,
          stepId: nextConnection.target,
        });
      }
      continue;
    }

    const workers = workerAvailability.get(step.id);
    const accumulator = taskAccumulators.get(step.id);
    if (!workers || !accumulator) continue;

    let workerIndex = 0;
    for (let index = 1; index < workers.length; index += 1) {
      if (workers[index] < workers[workerIndex]) workerIndex = index;
    }

    const baseDurationMinutes = step.durationMinutes ?? 0;
    const durationMinutes = sampleDuration(
      baseDurationMinutes,
      step.variabilityPercent ?? 0,
      random,
    );
    const hourlyCost = step.hourlyCost ?? 0;
    const startsAt = Math.max(event.at, workers[workerIndex]);
    const queueMinutes = startsAt - event.at;
    const finishesAt = startsAt + durationMinutes;
    workers[workerIndex] = finishesAt;

    if (queueMinutes > EPSILON) {
      recordTrace({
        at: event.at,
        transactionId: event.transactionId,
        kind: 'queue',
        stepId: step.id,
        queueMinutes,
      });
    }

    recordTrace({
      at: startsAt,
      transactionId: event.transactionId,
      kind: 'start',
      stepId: step.id,
      queueMinutes,
    });

    recordTrace({
      at: finishesAt,
      transactionId: event.transactionId,
      kind: 'finish',
      stepId: step.id,
    });

    accumulator.visits += 1;
    accumulator.busyMinutes += durationMinutes;
    accumulator.queueMinutes += queueMinutes;
    accumulator.processingCost += (durationMinutes / 60) * hourlyCost;
    totalQueueMinutes += queueMinutes;

    const nextConnection = chooseNextConnection(
      outgoingByStep.get(step.id) ?? [],
      random,
    );
    if (nextConnection) {
      const routeKey = `${nextConnection.source}::${nextConnection.target}`;
      routeVisits.set(routeKey, (routeVisits.get(routeKey) ?? 0) + 1);
      recordTrace({
        at: finishesAt,
        transactionId: event.transactionId,
        kind: 'route',
        stepId: nextConnection.target,
        fromStepId: nextConnection.source,
        toStepId: nextConnection.target,
      });
      eventQueue.push({
        at: finishesAt,
        transactionId: event.transactionId,
        stepId: nextConnection.target,
      });
    }
  }

  const completed = completionTimes.filter(Number.isFinite);
  const throughputWithinMonth = completionTimes.filter(
    (completion) => Number.isFinite(completion) && completion <= horizonMinutes,
  ).length;
  const backlogAtMonthEnd = transactionCount - throughputWithinMonth;
  const totalCycleMinutes = completionTimes.reduce((sum, completion, transactionId) => {
    if (!Number.isFinite(completion)) return sum;
    return sum + (completion - arrivals[transactionId]);
  }, 0);

  const taskMetrics: TaskSimulationMetric[] = taskSteps.map((step) => {
    const accumulator = taskAccumulators.get(step.id) ?? {
      visits: 0,
      busyMinutes: 0,
      queueMinutes: 0,
      processingCost: 0,
    };
    const workers = step.workers ?? 1;
    const durationMinutes = step.durationMinutes ?? 1;
    const availableMinutes = workers * horizonMinutes;

    return {
      taskId: step.id,
      label: step.label,
      visits: accumulator.visits,
      busyMinutes: accumulator.busyMinutes,
      averageQueueMinutes:
        accumulator.visits > 0 ? accumulator.queueMinutes / accumulator.visits : 0,
      workloadRatio: availableMinutes > 0 ? accumulator.busyMinutes / availableMinutes : 0,
      monthlyCapacity: Math.floor(availableMinutes / durationMinutes),
      processingCost: accumulator.processingCost,
    };
  });

  const bottleneck = taskMetrics.reduce<TaskSimulationMetric | null>((current, metric) => {
    if (metric.visits === 0) return current;
    if (!current || metric.workloadRatio > current.workloadRatio) return metric;
    return current;
  }, null);

  const totalProcessingCost = taskMetrics.reduce(
    (sum, metric) => sum + metric.processingCost,
    0,
  );

  const routeMetrics = connections.map((connection) => ({
    source: connection.source,
    target: connection.target,
    visits: routeVisits.get(`${connection.source}::${connection.target}`) ?? 0,
    probability: connection.probability,
  }));

  const traceKindOrder: Record<SimulationTraceEvent['kind'], number> = {
    arrive: 0,
    finish: 1,
    route: 2,
    queue: 3,
    start: 4,
    complete: 5,
  };

  traceEvents.sort(
    (left, right) =>
      left.at - right.at ||
      traceKindOrder[left.kind] - traceKindOrder[right.kind] ||
      left.transactionId - right.transactionId,
  );

  const trace = {
    sampledTransactionIds,
    events: traceEvents,
    startAt: traceEvents[0]?.at ?? 0,
    endAt: traceEvents[traceEvents.length - 1]?.at ?? 0,
  };

  return {
    transactions: transactionCount,
    completedTransactions: completed.length,
    throughputWithinMonth,
    backlogAtMonthEnd,
    averageCycleMinutes: completed.length > 0 ? totalCycleMinutes / completed.length : 0,
    averageQueueMinutes: transactionCount > 0 ? totalQueueMinutes / transactionCount : 0,
    totalProcessingCost,
    costPerTransaction: transactionCount > 0 ? totalProcessingCost / transactionCount : 0,
    bottleneckTaskId: bottleneck?.taskId ?? null,
    bottleneckLabel: bottleneck?.label ?? null,
    taskMetrics,
    routeMetrics,
    trace,
  };
}
