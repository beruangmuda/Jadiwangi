import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";

const KEY = "jadiwangi-pending-order-stages";
type Job = { id: string; target_status: string; employee_id?: string; employee_name?: string };

export async function flushOrderSync() {
  const jobs: Job[] = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
  const pending: Job[] = [];
  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    try { await api.post(`/orders/${job.id}/advance`, job); }
    catch { pending.push(...jobs.slice(index)); break; }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(pending));
}

export async function queueOrderStage(job: Job) {
  const jobs: Job[] = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
  if (!jobs.some((item) => item.id === job.id && item.target_status === job.target_status)) {
    jobs.push(job);
    await AsyncStorage.setItem(KEY, JSON.stringify(jobs));
  }
  void flushOrderSync();
}