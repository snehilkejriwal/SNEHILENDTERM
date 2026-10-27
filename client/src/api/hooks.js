import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useSendContact = () => useMutation({ mutationFn: async (body) => (await api.post('/contact', body)).data });
export const usePacks = () => useQuery({ queryKey: ['packs'], queryFn: async () => (await api.get('/packs')).data.packs, staleTime: 5 * 60 * 1000 });
export const usePack = (key) => useQuery({ queryKey: ['pack', key], queryFn: async () => (await api.get(`/packs/${key}`)).data.pack, enabled: Boolean(key), staleTime: 5 * 60 * 1000 });
export const useCases = () => useQuery({ queryKey: ['cases'], queryFn: async () => (await api.get('/cases')).data });
export const useCase = (id) => useQuery({ queryKey: ['case', id], queryFn: async () => (await api.get(`/cases/${id}`)).data.case, enabled: Boolean(id) });

// Every case mutation returns the updated case; write it straight into the cache.
function useCaseMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (data?.case) qc.setQueryData(['case', String(data.case.id)], data.case);
      qc.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

export const useCreateCase = () => useCaseMutation(async (body) => (await api.post('/cases', body)).data);
export const useUploadDocs = (id) => useCaseMutation(async ({ files, text }) => {
  const form = new FormData();
  (files || []).forEach((f) => form.append('files', f));
  if (text) form.append('text', text);
  return (await api.post(`/cases/${id}/documents`, form)).data;
});
export const useUpdateFacts = (id) => useCaseMutation(async (body) => (await api.patch(`/cases/${id}/facts`, body)).data);
export const useTransition = (id) => useCaseMutation(async (body) => (await api.post(`/cases/${id}/transition`, body)).data);
export const useDeleteCase = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id) => api.delete(`/cases/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }) });
};

export const useRules = () => useQuery({ queryKey: ['rules'], queryFn: async () => (await api.get('/admin/rules')).data.rules });
export const useAdminOverview = () => useQuery({ queryKey: ['admin-overview'], queryFn: async () => (await api.get('/admin/overview')).data });
export const useSaveRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => (id ? api.patch(`/admin/rules/${id}`, body) : api.post('/admin/rules', body)).then((r) => r.data.rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
};
