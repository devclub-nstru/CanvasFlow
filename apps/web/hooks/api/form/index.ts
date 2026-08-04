import { trpc } from "~/trpc/client";

export const useCreateForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFormAsync,
    mutate: createForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.createForm.useMutation({
    onMutate: async (input) => {
      await utils.form.listFormsByUserId.cancel();
      const previous = utils.form.listFormsByUserId.getData();

      utils.form.listFormsByUserId.setData(undefined, (old) => {
        const optimistic = {
          id: `optimistic-${Date.now()}`,
          title: input.title,
          description: input.description ?? null,
          slug: input.slug,
          isPublished: false,
          isArchived: false,
          isOpen: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          submissionsCount: 0,
          role: "owner" as const,
          permissions: {
            builder: { canView: true, canEdit: true },
            analytics: { canView: true },
            responses: { canView: true },
            settings: { canDelete: true, canPublish: true, canArchive: true, canShare: true },
          },
        };
        return old ? [optimistic, ...old] : [optimistic];
      });

      return { previous };
    },
    onError: (_err, _input, context) => {
      // Roll back on error
      if (context?.previous !== undefined) {
        utils.form.listFormsByUserId.setData(undefined, context.previous);
      }
    },
    onSettled: async () => {
      // Always refetch to get the real server data
      await utils.form.listFormsByUserId.invalidate();
      await utils.form.getDashboardStats.invalidate();
    },
  });

  return {
    createFormAsync,
    createForm,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useListFormsByUserId = () => {
  const {
    data: forms,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.listFormsByUserId.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    forms,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useCreateFormField = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFormFieldAsync,
    mutate: createFormField,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.createFormField.useMutation({
    onMutate: async (input) => {
      await utils.form.listFormFields.cancel({ formId: input.formId });
      const previous = utils.form.listFormFields.getData({ formId: input.formId });

      utils.form.listFormFields.setData({ formId: input.formId }, (old) => {
        const optimistic = {
          id: `optimistic-${Date.now()}`,
          formId: input.formId,
          segmentId: input.segmentId ?? null,
          label: input.label ?? "",
          labelKey: input.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "field",
          placeholder: input.placeholder ?? null,
          isRequired: input.isRequired ?? false,
          index: String(((old?.length ?? 0) + 1).toFixed(2)),
          type: input.type,
          options: input.options ?? null,
          description: input.description ?? null,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return old ? [...old, optimistic] : [optimistic];
      });

      return { previous, formId: input.formId };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        utils.form.listFormFields.setData({ formId: context.formId }, context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      void utils.form.listFormFields.invalidate({ formId: input.formId });
    },
  });

  return {
    createFormFieldAsync,
    createFormField,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useUpdateFormField = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateFormFieldAsync,
    mutate: updateFormField,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.updateFormField.useMutation({
    onSettled: () => {
      // updateFormField input has no formId, so invalidate all field
      // queries — still scoped to just fields, not the entire form router
      void utils.form.listFormFields.invalidate();
    },
  });

  return {
    updateFormFieldAsync,
    updateFormField,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useDeleteFormField = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteFormFieldAsync,
    mutate: deleteFormField,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.deleteFormField.useMutation({
    onSettled: () => {
      // deleteFormField input doesn't carry formId, so invalidate
      // all field queries (still much cheaper than invalidating all forms)
      void utils.form.listFormFields.invalidate();
    },
  });

  return {
    deleteFormFieldAsync,
    deleteFormField,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useGetFormField = (id: string) => {
  const {
    data: formField,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.getFormField.useQuery({ id }, { enabled: !!id && id.length === 36 });

  return {
    formField,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useGetForm = (id: string) => {
  const {
    data: form,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.getForm.useQuery({ id }, { enabled: !!id && id.length === 36 });

  return {
    form,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useListFormFields = (formId: string) => {
  const {
    data: fields,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.listFormFields.useQuery({ formId });

  return {
    fields,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useGetFormById = (id: string) => {
  const {
    data: form,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.getFormById.useQuery({ id }, { enabled: !!id && id.length === 36 });

  return {
    form,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const usePublishForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: publishFormAsync,
    mutate: publishForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.publishForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });

  return {
    publishFormAsync,
    publishForm,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useArchiveForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: archiveFormAsync,
    mutate: archiveForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.archiveForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });

  return {
    archiveFormAsync,
    archiveForm,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useUnarchiveForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: unarchiveFormAsync,
    mutate: unarchiveForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.unarchiveForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });

  return {
    unarchiveFormAsync,
    unarchiveForm,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useSubmitForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: submitFormAsync,
    mutate: submitForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.submitForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });

  return {
    submitFormAsync,
    submitForm,
    error,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
    failureCount,
  };
};

export const useGetDashboardStats = () => {
  const {
    data: stats,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.getDashboardStats.useQuery(undefined, {
    // The dashboard is the landing page after sign-in and on every
    // back-nav. Treat the result as fresh for 60s and serve from the
    // query cache so revisits paint instantly. Mutations that affect
    // these stats (create / delete form, etc.) already invalidate
    // this key, so stale data can't linger past a write.
    staleTime: 60_000,
    // Don't double-fetch when the tab regains focus during normal
    // use — the dashboard isn't a real-time view.
    refetchOnWindowFocus: false,
  });

  return {
    stats,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useDeleteForm = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteFormAsync,
    mutate: deleteForm,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.deleteForm.useMutation({
    onSuccess: () => {
      void utils.form.listFormsByUserId.invalidate();
      void utils.form.getDashboardStats.invalidate();
    },
  });

  return {
    deleteFormAsync,
    deleteForm,
    error,
    isPending,
    isSuccess,
    status,
  };
};

export const useListCollaborators = (formId: string) => {
  const {
    data: collaborators,
    isLoading,
    refetch,
  } = trpc.form.listCollaborators.useQuery(
    { formId },
    { enabled: !!formId && formId.length === 36 },
  );

  return {
    collaborators,
    isLoading,
    refetch,
  };
};

export const useAddCollaborator = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: addCollaboratorAsync,
    isPending,
    error,
  } = trpc.form.addCollaborator.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.listCollaborators.invalidate({ formId: variables.formId });
    },
  });

  return {
    addCollaboratorAsync,
    isPending,
    error,
  };
};

export const useUpdateCollaboratorRole = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: updateCollaboratorRoleAsync,
    isPending,
    error,
  } = trpc.form.updateCollaboratorRole.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.listCollaborators.invalidate({ formId: variables.formId });
    },
  });

  return {
    updateCollaboratorRoleAsync,
    isPending,
    error,
  };
};

export const useRemoveCollaborator = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: removeCollaboratorAsync,
    isPending,
    error,
  } = trpc.form.removeCollaborator.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.listCollaborators.invalidate({ formId: variables.formId });
    },
  });

  return {
    removeCollaboratorAsync,
    isPending,
    error,
  };
};

export const useTransferOwnership = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: transferOwnershipAsync,
    isPending,
    error,
  } = trpc.form.transferOwnership.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.listCollaborators.invalidate({ formId: variables.formId });
      void utils.form.getForm.invalidate({ id: variables.formId });
      void utils.form.listFormsByUserId.invalidate();
    },
  });

  return {
    transferOwnershipAsync,
    isPending,
    error,
  };
};

export const useUpdateFormSettings = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: updateFormSettingsAsync,
    isPending,
    error,
  } = trpc.form.updateFormSettings.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.getForm.invalidate({ id: variables.id });
      void utils.form.getFormById.invalidate({ id: variables.id });
      void utils.form.listFormsByUserId.invalidate();
    },
  });

  return {
    updateFormSettingsAsync,
    isPending,
    error,
  };
};

/* ─── Segments ────────────────────────────────────────────────────────── */

export const useListFormSegments = (formId: string) => {
  const {
    data: segments,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.listFormSegments.useQuery(
    { formId },
    { enabled: !!formId && formId.length === 36 },
  );

  return {
    segments,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useCreateFormSegment = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFormSegmentAsync,
    mutate: createFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.createFormSegment.useMutation({
    // No optimistic update here, unlike createFormField. The first segment
    // on a form also materialises "Segment 1" and re-parents every existing
    // question server-side; the client can't predict those ids, so guessing
    // would paint a segment list that has to be thrown away a moment later.
    onSettled: (_data, _err, input) => {
      void utils.form.listFormSegments.invalidate({ formId: input.formId });
      // Fields move into the default segment as part of this call.
      void utils.form.listFormFields.invalidate({ formId: input.formId });
    },
  });

  return {
    createFormSegmentAsync,
    createFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  };
};

export const useUpdateFormSegment = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateFormSegmentAsync,
    mutate: updateFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.updateFormSegment.useMutation({
    // Input carries only the segment id, so scope-by-formId isn't available
    // — same trade-off the field mutations already make.
    onSettled: () => {
      void utils.form.listFormSegments.invalidate();
    },
  });

  return {
    updateFormSegmentAsync,
    updateFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  };
};

export const useDeleteFormSegment = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteFormSegmentAsync,
    mutate: deleteFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.deleteFormSegment.useMutation({
    onSettled: () => {
      void utils.form.listFormSegments.invalidate();
      // Questions in the deleted segment fall back to the implicit first
      // segment, and rules targeting it are cascade-deleted.
      void utils.form.listFormFields.invalidate();
      void utils.form.listLogicRules.invalidate();
    },
  });

  return {
    deleteFormSegmentAsync,
    deleteFormSegment,
    error,
    isPending,
    isSuccess,
    status,
  };
};

/* ─── Conditional branching ───────────────────────────────────────────── */

export const useListLogicRules = (formId: string) => {
  const {
    data: logicRules,
    error,
    failureCount,
    isError,
    isSuccess,
    status,
    isLoading,
    refetch,
  } = trpc.form.listLogicRules.useQuery({ formId }, { enabled: !!formId && formId.length === 36 });

  return {
    logicRules,
    error,
    isError,
    isSuccess,
    status,
    failureCount,
    isLoading,
    refetch,
  };
};

export const useCreateLogicRule = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createLogicRuleAsync,
    mutate: createLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.createLogicRule.useMutation({
    onSettled: (_data, _err, input) => {
      void utils.form.listLogicRules.invalidate({ formId: input.formId });
    },
  });

  return {
    createLogicRuleAsync,
    createLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  };
};

export const useUpdateLogicRule = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateLogicRuleAsync,
    mutate: updateLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.updateLogicRule.useMutation({
    onSettled: () => {
      void utils.form.listLogicRules.invalidate();
    },
  });

  return {
    updateLogicRuleAsync,
    updateLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  };
};

export const useDeleteLogicRule = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteLogicRuleAsync,
    mutate: deleteLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  } = trpc.form.deleteLogicRule.useMutation({
    onSettled: () => {
      void utils.form.listLogicRules.invalidate();
    },
  });

  return {
    deleteLogicRuleAsync,
    deleteLogicRule,
    error,
    isPending,
    isSuccess,
    status,
  };
};

/* ─── Drafts ──────────────────────────────────────────────────────────── */

/**
 * The signed-in respondent's saved progress on a form, or null.
 *
 * `enabled` gates on the caller telling us they're signed in: the procedure is
 * authenticated, so calling it anonymously is a guaranteed 401 on every public
 * form load. `retry: false` for the same reason — a failure here means "no
 * draft", never something worth retrying.
 *
 * `staleTime: Infinity` because the draft is only read once, to restore. After
 * that the renderer's own state is the truth, and a refetch that overwrote it
 * mid-typing would be a bug rather than a refresh.
 */
export const useGetDraft = (formId: string, enabled: boolean) => {
  const {
    data: draft,
    isLoading,
    isFetched,
  } = trpc.form.getDraft.useQuery(
    { formId },
    {
      enabled: enabled && !!formId && formId.length === 36,
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  );

  return { draft, isLoading, isFetched };
};

export const useSaveDraft = () => {
  const {
    mutateAsync: saveDraftAsync,
    mutate: saveDraft,
    isPending,
    error,
  } = trpc.form.saveDraft.useMutation({
    // Deliberately no invalidation. This fires repeatedly while someone types,
    // and refetching the draft we just wrote would pull the server's copy back
    // over the state that produced it.
  });

  return { saveDraftAsync, saveDraft, isPending, error };
};

export const useDeleteDraft = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteDraftAsync,
    mutate: deleteDraft,
    isPending,
  } = trpc.form.deleteDraft.useMutation({
    onSettled: (_data, _err, input) => {
      void utils.form.getDraft.invalidate({ formId: input.formId });
    },
  });

  return { deleteDraftAsync, deleteDraft, isPending };
};
