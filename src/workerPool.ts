import { ParseResult } from "./fileParser.worker";

// Worker Pool Manager
export type ParseResultStatus = "completed" | "error";

type BusyWorker = Worker & { busy?: boolean };

type Task = {
  file: File;
  resolve: (value: ParseResult) => void;
  reject: (reason?: unknown) => void;
};

export class WorkerPool {
  private poolSize: number;
  private workers: BusyWorker[];
  private queue: Task[];
  private activeWorkers: number;

  constructor(
    poolSize = navigator.hardwareConcurrency > 1
      ? navigator.hardwareConcurrency - 1
      : 4
  ) {
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.activeWorkers = 0;
    this.initialize();
  }

  private initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push(
        new Worker(new URL("./fileParser.worker.ts", import.meta.url))
      );
    }
  }

  processFile(file: File): Promise<ParseResult> {
    return new Promise<ParseResult>((resolve, reject) => {
      const task: Task = { file, resolve, reject };
      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    // ищем свободного воркера
    const workerIndex = this.workers.findIndex((w) => !w.busy);

    if (workerIndex === -1) return; // все заняты, ждём

    const worker = this.workers[workerIndex];
    worker.busy = true;
    this.activeWorkers++;

    const task = this.queue.shift()!;

    const messageHandler = (e: MessageEvent<ParseResult>) => {
      worker.removeEventListener("message", messageHandler as EventListener);

      task.resolve(e.data);

      // terminate старого воркера, чтобы освободить память
      worker.terminate();

      // создаём новый воркер на его место
      const newWorker = new Worker(
        new URL("./fileParser.worker.ts", import.meta.url)
      ) as BusyWorker;
      newWorker.busy = false;
      this.workers[workerIndex] = newWorker;

      this.activeWorkers--;
      this.processQueue();
    };

    worker.addEventListener("message", messageHandler as EventListener);
    worker.postMessage(task.file);
  }

  terminate() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.queue = [];
    this.activeWorkers = 0;
  }
}
