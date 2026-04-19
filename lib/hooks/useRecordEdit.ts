'use client';

import { useCallback, useState } from 'react';
import { ref, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { toast } from 'sonner';
import { useSaveStore } from './useSaveStatus';
import { useAuth } from '@/lib/auth/context';
import { can } from '@/lib/auth/rbac';

/**
 * RTDB 레코드 편집 훅.
 * `path` + `key` 조합으로 update (부분 패치) / soft-delete (status='deleted').
 * 권한 체크: 편집은 operator 이상, 삭제는 admin 이상.
 */
export function useRecordEdit<T extends { _key?: string }>(path: string) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const canEdit = user ? can(user.role, 'edit.master') : false;
  const canDelete = user ? can(user.role, 'delete.master') : false;

  const save = useCallback(async (record: T, patch: Partial<T>) => {
    if (!record._key) {
      toast.error('레코드 키가 없습니다');
      return false;
    }
    if (!canEdit) {
      toast.error('편집 권한이 없습니다');
      return false;
    }
    setSaving(true);
    const store = useSaveStore.getState();
    store.begin('저장 중');
    try {
      await update(ref(getRtdb(), `${path}/${record._key}`), {
        ...patch,
        updated_at: serverTimestamp(),
      });
      store.success('저장 완료');
      toast.success('저장 완료');
      return true;
    } catch (err) {
      store.fail((err as Error).message || '저장 실패');
      toast.error(`저장 실패: ${(err as Error).message}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [path, canEdit]);

  const remove = useCallback(async (record: T) => {
    if (!record._key) return false;
    if (!canDelete) {
      toast.error('삭제 권한이 없습니다');
      return false;
    }
    setSaving(true);
    const store = useSaveStore.getState();
    store.begin('삭제 중');
    try {
      await update(ref(getRtdb(), `${path}/${record._key}`), {
        status: 'deleted',
        deleted_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      store.success('삭제 완료');
      toast.success('삭제 완료');
      return true;
    } catch (err) {
      store.fail((err as Error).message || '삭제 실패');
      toast.error(`삭제 실패: ${(err as Error).message}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [path, canDelete]);

  return { save, remove, saving, canEdit, canDelete };
}
