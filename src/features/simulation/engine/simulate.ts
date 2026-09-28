import type {
  ProcessConnection,
  ProcessTask,
  SimulationResult,
  SimulationSettings,
  TaskSimulationMetric,
} from './types';

interface SimulationEvent {
  at: number;
  transactionId: number;
  taskId: string;
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

const EPSILON = 1e-9;

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

function validateProcess(
  tasks: ProcessTask[],
  connections: ProcessConnection[],
  settings: SimulationSettings,
) {
  if (tasks.length === 0) throw new Error('Add at least one task before running a simulation.');

  assertPositiveFinite(settings.monthlyVolume, 'Monthly volume');
  assertPositiveFinite(settings.workdaysPerMonth, 'Workdays per month');
  assertPositiveFinite(settings.hoursPerDay, 'Hours per day');

  const taskIds = new Set<string>();
  for (const task of tasks) {
    if (!task.id.trim()) throw new Error('Every task requires an ID.');
    if (taskIds.has(task.id)) throw new Error(`Duplicate task ID: ${task.id}`);
    taskIds.add(task.id);
    assertPositiveFinite(task.durationMinutes, `${task.label} duration`);
    assertPositiveFinite(task.workers, `${task.label} workers`);
    if (!Number.isInteger(task.workers)) throw new Error(`${task.label} workers must be a whole number.`);
    if (!Number.isFinite(task.hourlyCost) || task.hourlyCost < 0) {
      throw new Error(`${task.label} hourly cost cannot be negative.`);
    }
  }

  const incomingCount = new Map(tasks.map((task) => [task.id, 0]));
  const adjacency = new Map(tasks.map((task) => [task.id, [] as string[]]));

  for (const connection of connections) {
    if (!taskIds.has(connection.source) || !taskIds.has(connection.target)) {
      throw new Error('A connection references a task that no longer exists.');
    }
    adjacency.get(connection.source)?.push(connection.target);
    incomingCount.set(connection.target, (incomingCount.get(connection.target) ?? 0) + 1);
  }

  const startTasks = tasks.filter((task) => (incomingCount.get(task.id) ?? 0) === 0);
  if (startTasks.length !== 1) {
    throw new Error('The process must have exactly one starting task.');
  }

  const indegree = new Map(incomingCount);
  const queue = startTasks.map((task) => task.id);
  let visited = 0;

  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) continue;
    visited += 1;

    for (const next of adjacency.get(taskId) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (visited !== tasks.length) {
    throw new Error('Cycles are not supported yet. Remove the loop before running the simulation.');
  }

  return startTasks[0].id;
}

function chooseNextConnection(
  outgoing: ProcessConnection[],
  random: () => number,
): ProcessConnection | undefined {
  if (outgoing.length === 0) return undefined;
  if (outgoing.length === 1) return outgoing[0];

  const allProbabilitiesSpecified = outgoing.every(
    (connection) => connection.probability !== undefined,
  );

  const weighted = allProbabilitiesSpecified
    ? outgoing.map((connection) => connection.probability ?? 0)
    : outgoing.map(() => 1 / outgoing.length);

  const total = weighted.reduce((sum, weight) => sum + weight, 0);
  if (total <= EPSILON) throw new Error('Branch probabilities must add up to more than zero.');

  let cursor = random() * total;
  for (let index = 0; index < outgoing.length; index += 1) {
    cursor -= weighted[index];
    if (cursor <= 0) return outgoing[index];
  }

  return outgoing[outgoing.length - 1];
}

export function simulateProcess(
  tasks: ProcessTask[],
  connections: ProcessConnection[],
  settings: SimulationSettings,
): SimulationResult {
  const startTaskId = validateProcess(tasks, connections, settings);
  const transactionCount = Math.max(1, Math.floor(settings.monthlyVolume));
  const horizonMinutes = settings.workdaysPerMonth * settings.hoursPerDay * 60;
  const random = createSeededRandom(settings.seed ?? 20260928);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const outgoingByTask = new Map(tasks.map((task) => [task.id, [] as ProcessConnection[]]));
  for (const connection of connections) {
    outgoingByTask.get(connection.source)?.push(connection);
  }

  const workerAvailability = new Map(
    tasks.map((task) => [task.id, Array.from({ length: task.workers }, () => 0)]),
  );
  const taskAccumulators = new Map<string, TaskAccumulator>(
    tasks.map((task) => [
      task.id,
      { visits: 0, busyMinutes: 0, queueMinutes: 0, processingCost: 0 },
    ]),
  );

  const arrivals = Array.from({ length: transactionCount }, (_, index) => {
    const bucketSize = horizonMinutes / transactionCount;
    return index * bucketSize + random() * bucketSize;
  });

  const eventQueue = new MinHeap();
  arrivals.forEach((arrival, transactionId) => {
    eventQueue.push({ at: arrival, transactionId, taskId: startTaskId });
  });

  const completionTimes = new Array<number>(transactionCount).fill(Number.NaN);
  let totalQueueMinutes = 0;

  while (eventQueue.size > 0) {
    const event = eventQueue.pop();
    if (!event) break;

    const task = taskById.get(event.taskId);
    const workers = workerAvailability.get(event.taskId);
    const accumulator = taskAccumulators.get(event.taskId);
    if (!task || !workers || !accumulator) continue;

    let workerIndex = 0;
    for (let index = 1; index < workers.length; index += 1) {
      if (workers[index] < workers[workerIndex]) workerIndex = index;
    }

    const startsAt = Math.max(event.at, workers[workerIndex]);
    const queueMinutes = startsAt - event.at;
    const finishesAt = startsAt + task.durationMinutes;
    workers[workerIndex] = finishesAt;

    accumulator.visits += 1;
    accumulator.busyMinutes += task.durationMinutes;
    accumulator.queueMinutes += queueMinutes;
    accumulator.processingCost += (task.durationMinutes / 60) * task.hourlyCost;
    totalQueueMinutes += queueMinutes;

    const nextConnection = chooseNextConnection(outgoingByTask.get(task.id) ?? [], random);
    if (nextConnection) {
      eventQueue.push({
        at: finishesAt,
        transactionId: event.transactionId,
        taskId: nextConnection.target,
      });
    } else {
      completionTimes[event.transactionId] = finishesAt;
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

  const taskMetrics: TaskSimulationMetric[] = tasks.map((task) => {
    const accumulator = taskAccumulators.get(task.id) ?? {
      visits: 0,
      busyMinutes: 0,
      queueMinutes: 0,
      processingCost: 0,
    };
    const availableMinutes = task.workers * horizonMinutes;

    return {
      taskId: task.id,
      label: task.label,
      visits: accumulator.visits,
      busyMinutes: accumulator.busyMinutes,
      averageQueueMinutes:
        accumulator.visits > 0 ? accumulator.queueMinutes / accumulator.visits : 0,
      workloadRatio: availableMinutes > 0 ? accumulator.busyMinutes / availableMinutes : 0,
      monthlyCapacity: Math.floor(availableMinutes / task.durationMinutes),
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
  };
}
