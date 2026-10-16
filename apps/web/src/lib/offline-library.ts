import type { NewspaperEdition } from "./newspaper-pages.ts";
import type { WeeklyMagazine } from "./weekly-magazine.ts";

export type OfflineItem =
  | { key: string; kind: "daily"; issueDate: string; title: string; savedAt: string; payload: NewspaperEdition }
  | { key: string; kind: "weekly"; issueDate: string; title: string; savedAt: string; payload: WeeklyMagazine };

const DB_NAME = "news-radar-pocket";
const STORE = "issues";
const DB_VERSION = 1;
const PROGRESS_PREFIX = "news-radar:reading:v1:";

export function offlineKey(kind: "daily" | "weekly", date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid issue date");
  return kind + ":" + date;
}
export function offlineHref(item: Pick<OfflineItem, "kind" | "issueDate">): string {
  return item.kind === "daily" ? "/edition/?date=" + item.issueDate : "/magazine/?week=" + item.issueDate;
}
export function normalizeSavedPage(value: unknown): number {
  const page = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100 ? page : 1;
}
export function progressKey(key: string): string {
  return PROGRESS_PREFIX + key;
}
export function getReadingPage(key: string): number {
  try { return normalizeSavedPage(localStorage.getItem(progressKey(key))); } catch { return 1; }
}
export function setReadingPage(key: string, page: number): void {
  try { localStorage.setItem(progressKey(key), String(normalizeSavedPage(page))); } catch { /* storage may be restricted */ }
}
export function clearReadingPage(key: string): void {
  try { localStorage.removeItem(progressKey(key)); } catch {}
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Trình duyệt không hỗ trợ lưu offline.")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, {keyPath:"key"});
    };
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (result: T) => void, reject: (error: Error) => void) => void
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const finish = (value:T) => { completed = true; resolve(value); };
    tx.onerror = () => { if(!completed) reject(tx.error ?? new Error("Lỗi bộ nhớ offline.")); };
    tx.onabort = () => { if(!completed) reject(tx.error ?? new Error("Không lưu được bản báo.")); };
    tx.oncomplete = () => db.close();
    action(store, finish, reject);
  });
}
export async function saveOfflineIssue(kind: "daily", issue: NewspaperEdition): Promise<void>;
export async function saveOfflineIssue(kind: "weekly", issue: WeeklyMagazine): Promise<void>;
export async function saveOfflineIssue(kind: "daily" | "weekly", issue: NewspaperEdition | WeeklyMagazine): Promise<void> {
  const issueDate = kind === "daily" ? (issue as NewspaperEdition).issueDate : (issue as WeeklyMagazine).weekStart;
  const key = offlineKey(kind, issueDate);
  const entry = {
    key, kind, issueDate, title: issue.title, savedAt: new Date().toISOString(),
    payload: issue,
  } as OfflineItem;
  await transaction<void>("readwrite", (store, resolve, reject) => {
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Không thể lưu số báo."));
  });
}
export async function getOfflineIssue(key: string): Promise<OfflineItem | null> {
  return transaction<OfflineItem|null>("readonly",(store,resolve,reject)=>{
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as OfflineItem|undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Không thể đọc bản offline."));
  });
}
export async function listOfflineIssues(): Promise<OfflineItem[]> {
  return transaction<OfflineItem[]>("readonly",(store,resolve,reject)=>{
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflineItem[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
    req.onerror = () => reject(req.error ?? new Error("Không thể mở thư viện offline."));
  });
}
export async function removeOfflineIssue(key: string): Promise<void> {
  await transaction<void>("readwrite",(store,resolve,reject)=>{
    const req=store.delete(key);
    req.onsuccess=()=>resolve();
    req.onerror=()=>reject(req.error ?? new Error("Không thể xóa số báo."));
  });
  clearReadingPage(key);
}
export async function newestOfflineIssue(kind: "daily" | "weekly"): Promise<OfflineItem | null> {
  const all=await listOfflineIssues();
  return all.filter(item=>item.kind===kind).sort((a,b)=>b.issueDate.localeCompare(a.issueDate))[0] ?? null;
}
