import { getDatabase, type Database } from 'firebase/database';
import { getFirebaseApp } from './client';

let _rtdb: Database | null = null;

/**
 * 기존 jpkerp 프로젝트의 Realtime Database.
 * Phase 5 이주 전까지 브릿지로 사용.
 */
export function getRtdb(): Database {
  if (!_rtdb) _rtdb = getDatabase(getFirebaseApp());
  return _rtdb;
}
