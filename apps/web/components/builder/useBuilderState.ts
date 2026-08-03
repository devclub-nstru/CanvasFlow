import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Edge, Node, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import { toast } from "sonner";

import {
  useGetForm,
  useListFormFields,
  useCreateFormField,
  useUpdateFormField,
  useDeleteFormField,
  usePublishForm,
  useDeleteForm,
  useListFormSegments,
  useCreateFormSegment,
  useUpdateFormSegment,
  useDeleteFormSegment,
  useListLogicRules,
  useCreateLogicRule,
  useUpdateLogicRule,
  useDeleteLogicRule,
} from "~/hooks/api/form";
import { useDashboard } from "~/providers/dashboard-provider";
import { indexBetween, isBetween, parseIndex, formatIndex } from "~/lib/fractional-index";
import { getFieldOptionsArray } from "~/components/builder/FormFieldNode";
import { BuilderView } from "~/components/builder/BuilderHeader";
import {
  buildFlow,
  type FlowCondition,
  type FlowRule,
  type FlowField,
  type FlowSegment,
} from "~/lib/form-flow";
import { describeRule, isRuleComplete, type FlowLabels } from "~/lib/form-logic";

const VIEW_STORAGE_KEY = "canvasflow:builder-view";

export type LocalField = NonNullable<ReturnType<typeof useListFormFields>["fields"]>[number] & {
  _isNew?: boolean;
};
export type LocalSegment = NonNullable<
  ReturnType<typeof useListFormSegments>["segments"]
>[number] & { _isNew?: boolean };
export type LocalRule = NonNullable<ReturnType<typeof useListLogicRules>["logicRules"]>[number] & {
  _isNew?: boolean;
};

export function useBuilderState() {
  const params = useParams();
  const formId = params.formId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { form, isLoading: formLoading, refetch: refetchForm } = useGetForm(formId);
  const { fields, isLoading: fieldsLoading, refetch: refetchFields } = useListFormFields(formId);
  const { segments, refetch: refetchSegments } = useListFormSegments(formId);
  const { logicRules, refetch: refetchRules } = useListLogicRules(formId);

  const { setIsCreatingForm } = useDashboard();
  useEffect(() => {
    if (!formLoading && !fieldsLoading) {
      setIsCreatingForm(false);
    }
  }, [formLoading, fieldsLoading, setIsCreatingForm]);

  const { createFormFieldAsync } = useCreateFormField();
  const { updateFormFieldAsync } = useUpdateFormField();
  const { deleteFormFieldAsync } = useDeleteFormField();
  const { createFormSegmentAsync } = useCreateFormSegment();
  const { updateFormSegmentAsync } = useUpdateFormSegment();
  const { deleteFormSegmentAsync } = useDeleteFormSegment();
  const { createLogicRuleAsync } = useCreateLogicRule();
  const { updateLogicRuleAsync } = useUpdateLogicRule();
  const { deleteLogicRuleAsync } = useDeleteLogicRule();
  const { publishForm, isPending: publishPending } = usePublishForm();
  const { deleteFormAsync, isPending: deletePending } = useDeleteForm();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const [localFields, setLocalFields] = useState<LocalField[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const [localSegments, setLocalSegments] = useState<LocalSegment[]>([]);
  const [dirtySegmentIds, setDirtySegmentIds] = useState<Set<string>>(new Set());
  const [pendingSegmentDeletes, setPendingSegmentDeletes] = useState<Set<string>>(new Set());

  const [localRules, setLocalRules] = useState<LocalRule[]>([]);
  const [dirtyRuleIds, setDirtyRuleIds] = useState<Set<string>>(new Set());
  const [pendingRuleDeletes, setPendingRuleDeletes] = useState<Set<string>>(new Set());

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const [mobileSegmentsOpen, setMobileSegmentsOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

  const isDirty =
    dirtyIds.size > 0 ||
    pendingDeletes.size > 0 ||
    dirtySegmentIds.size > 0 ||
    pendingSegmentDeletes.size > 0 ||
    dirtyRuleIds.size > 0 ||
    pendingRuleDeletes.size > 0;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (fields && localFields.length === 0) {
      setLocalFields(fields as LocalField[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const segmentsSeededRef = useRef(false);
  useEffect(() => {
    if (segments && !segmentsSeededRef.current) {
      segmentsSeededRef.current = true;
      setLocalSegments(segments as LocalSegment[]);
    }
  }, [segments]);

  const rulesSeededRef = useRef(false);
  useEffect(() => {
    if (logicRules && !rulesSeededRef.current) {
      rulesSeededRef.current = true;
      setLocalRules(logicRules as LocalRule[]);
    }
  }, [logicRules]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const tempIdToRealId = new Map<string, string>();
      const updatedVersionById = new Map<string, number>();

      const tempSegmentIdToRealId = new Map<string, string>();
      const updatedSegmentVersionById = new Map<string, number>();

      const newSegments = localSegments
        .filter((s) => s._isNew && !pendingSegmentDeletes.has(s.id))
        .sort((a, b) => parseIndex(a.index) - parseIndex(b.index));

      for (const segment of newSegments) {
        const created = await createFormSegmentAsync({
          formId,
          title: segment.title.trim() || "Untitled segment",
          description: segment.description ?? undefined,
          index: parseIndex(segment.index),
          adoptUnassignedFields: false,
        });
        if (created?.id) tempSegmentIdToRealId.set(segment.id, created.id);
      }

      await Promise.all(
        localSegments
          .filter((s) => !s._isNew && dirtySegmentIds.has(s.id) && !pendingSegmentDeletes.has(s.id))
          .map((s) =>
            updateFormSegmentAsync({
              id: s.id,
              title: s.title.trim() || "Untitled segment",
              description: s.description ?? undefined,
              index: String(s.index),
              expectedVersion: typeof s.version === "number" ? s.version : 0,
            }).then((data) => {
              updatedSegmentVersionById.set(s.id, data.version);
            }),
          ),
      );

      const resolveSegmentId = (id: string | null | undefined): string | null => {
        if (!id) return null;
        return tempSegmentIdToRealId.get(id) ?? id;
      };

      const createOps = localFields
        .filter((f) => f._isNew && !pendingDeletes.has(f.id))
        .map((f) => {
          const tempId = f.id;
          return createFormFieldAsync({
            formId,
            segmentId: resolveSegmentId(f.segmentId),
            label: f.label,
            type: f.type as any,
            isRequired: f.isRequired,
            placeholder: f.placeholder ?? undefined,
            description: f.description ?? undefined,
            options: f.options ?? undefined,
            index: f.index ? parseFloat(String(f.index)) : undefined,
          }).then((data: any) => {
            if (data?.id) tempIdToRealId.set(tempId, data.id);
          });
        });

      const updateOps = localFields
        .filter((f) => !f._isNew && dirtyIds.has(f.id) && !pendingDeletes.has(f.id))
        .map((f) =>
          updateFormFieldAsync({
            id: f.id,
            segmentId: resolveSegmentId(f.segmentId),
            label: f.label,
            placeholder: f.placeholder ?? undefined,
            description: f.description ?? undefined,
            isRequired: f.isRequired,
            options: f.options ?? undefined,
            index: f.index ? String(f.index) : undefined,
            expectedVersion: typeof (f as any).version === "number" ? (f as any).version : 0,
          }).then((data) => {
            updatedVersionById.set(f.id, data.version);
          }),
        );

      const deleteOps = localFields
        .filter((f) => !f._isNew && pendingDeletes.has(f.id))
        .map((f) => deleteFormFieldAsync({ id: f.id }));

      await Promise.all([...createOps, ...updateOps, ...deleteOps]);

      const resolveFieldId = (id: string | null | undefined): string | null => {
        if (!id) return null;
        return tempIdToRealId.get(id) ?? id;
      };

      const resolveRule = (rule: LocalRule) => ({
        ...rule,
        fieldId: resolveFieldId(rule.fieldId) ?? rule.fieldId,
        targetFieldId: rule.action === "JUMP_TO_FIELD" ? resolveFieldId(rule.targetFieldId) : null,
        targetSegmentId:
          rule.action === "JUMP_TO_SEGMENT" ? resolveSegmentId(rule.targetSegmentId) : null,
        elseTargetFieldId:
          rule.elseAction === "JUMP_TO_FIELD" ? resolveFieldId(rule.elseTargetFieldId) : null,
        elseTargetSegmentId:
          rule.elseAction === "JUMP_TO_SEGMENT" ? resolveSegmentId(rule.elseTargetSegmentId) : null,
        conditions: (rule.conditions ?? []).map((condition) => ({
          ...condition,
          fieldId: resolveFieldId(condition.fieldId) ?? condition.fieldId,
        })),
      });

      const isSaveable = (rule: LocalRule): boolean => {
        const resolved = resolveRule(rule);
        if (!isRuleComplete(resolved as unknown as FlowRule)) return false;
        if (pendingDeletes.has(rule.fieldId)) return false;

        const referenced = [
          resolved.fieldId,
          resolved.targetFieldId,
          resolved.elseTargetFieldId,
          ...resolved.conditions.map((c) => c.fieldId),
        ].filter((id): id is string => !!id);

        return referenced.every((id) => !pendingDeletes.has(id) && !!resolveFieldId(id));
      };

      const conditionPayload = (rule: ReturnType<typeof resolveRule>) =>
        rule.conditions.map((condition, i) => ({
          fieldId: condition.fieldId,
          operator: condition.operator,
          value:
            condition.operator === "IS_EMPTY" || condition.operator === "IS_NOT_EMPTY"
              ? undefined
              : condition.value,
          index: i + 1,
        }));

      const skippedRules = localRules.filter(
        (r) =>
          !pendingRuleDeletes.has(r.id) && (r._isNew || dirtyRuleIds.has(r.id)) && !isSaveable(r),
      ).length;

      const ruleCreateOps = localRules
        .filter((r) => r._isNew && !pendingRuleDeletes.has(r.id) && isSaveable(r))
        .map((r) => {
          const resolved = resolveRule(r);
          return createLogicRuleAsync({
            formId,
            fieldId: resolved.fieldId,
            match: resolved.match,
            conditions: conditionPayload(resolved),
            action: resolved.action,
            targetFieldId: resolved.targetFieldId,
            targetSegmentId: resolved.targetSegmentId,
            elseAction: resolved.elseAction ?? null,
            elseTargetFieldId: resolved.elseTargetFieldId,
            elseTargetSegmentId: resolved.elseTargetSegmentId,
            index: parseIndex(r.index),
          });
        });

      const ruleUpdateOps = localRules
        .filter(
          (r) =>
            !r._isNew && dirtyRuleIds.has(r.id) && !pendingRuleDeletes.has(r.id) && isSaveable(r),
        )
        .map((r) => {
          const resolved = resolveRule(r);
          return updateLogicRuleAsync({
            id: r.id,
            match: resolved.match,
            conditions: conditionPayload(resolved),
            action: resolved.action,
            targetFieldId: resolved.targetFieldId,
            targetSegmentId: resolved.targetSegmentId,
            elseAction: resolved.elseAction ?? null,
            elseTargetFieldId: resolved.elseTargetFieldId,
            elseTargetSegmentId: resolved.elseTargetSegmentId,
            index: String(r.index),
            expectedVersion: typeof r.version === "number" ? r.version : 0,
          });
        });

      const ruleDeleteOps = localRules
        .filter((r) => !r._isNew && pendingRuleDeletes.has(r.id))
        .map((r) => deleteLogicRuleAsync({ id: r.id }));

      await Promise.all([...ruleCreateOps, ...ruleUpdateOps, ...ruleDeleteOps]);

      await Promise.all(
        localSegments
          .filter((s) => !s._isNew && pendingSegmentDeletes.has(s.id))
          .map((s) => deleteFormSegmentAsync({ id: s.id })),
      );

      const [freshSegments, freshRules] = await Promise.all([refetchSegments(), refetchRules()]);
      if (freshSegments.data) setLocalSegments(freshSegments.data as LocalSegment[]);
      if (freshRules.data) setLocalRules(freshRules.data as LocalRule[]);
      setDirtySegmentIds(new Set());
      setPendingSegmentDeletes(new Set());
      setDirtyRuleIds(new Set());
      setPendingRuleDeletes(new Set());
      if (selectedSegmentId && tempSegmentIdToRealId.has(selectedSegmentId)) {
        setSelectedSegmentId(tempSegmentIdToRealId.get(selectedSegmentId) as string);
      }
      if (skippedRules > 0) {
        toast.warning(
          `${skippedRules} branching ${skippedRules === 1 ? "rule was" : "rules were"} left unsaved — finish setting ${skippedRules === 1 ? "it" : "them"} up`,
        );
      }

      setLocalFields((prev) =>
        prev
          .filter((f) => !pendingDeletes.has(f.id))
          .map((f) => {
            const realId = tempIdToRealId.get(f.id);
            const newVersion = updatedVersionById.get(realId ?? f.id);
            const next: any = { ...f, _isNew: false };
            if (realId) next.id = realId;
            if (newVersion !== undefined) next.version = newVersion;

            next.segmentId = resolveSegmentId(f.segmentId);
            return next;
          }),
      );
      setSelectedNodeId((prev) =>
        prev && tempIdToRealId.has(prev) ? (tempIdToRealId.get(prev) as string) : prev,
      );
      setDirtyIds(new Set());
      setPendingDeletes(new Set());
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
      toast.success("Saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isLockConflict =
        message.includes("modified by someone else") ||
        message.includes("raced with another change");

      if (isLockConflict) {
        toast.error("This form was edited from another session — reloading your view");
        const [refreshed, freshSegments, freshRules] = await Promise.all([
          refetchFields(),
          refetchSegments(),
          refetchRules(),
        ]);
        if (refreshed.data) {
          setLocalFields(refreshed.data as any);
          setDirtyIds(new Set());
          setPendingDeletes(new Set());
        }
        if (freshSegments.data) {
          setLocalSegments(freshSegments.data as LocalSegment[]);
          setDirtySegmentIds(new Set());
          setPendingDeletes(new Set());
        }
        if (freshRules.data) {
          setLocalRules(freshRules.data as LocalRule[]);
          setDirtyRuleIds(new Set());
          setPendingRuleDeletes(new Set());
        }
      } else {
        toast.error("Some changes failed to save — please retry");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    isDirty,
    isSaving,
    localFields,
    dirtyIds,
    pendingDeletes,
    formId,
    createFormFieldAsync,
    updateFormFieldAsync,
    deleteFormFieldAsync,
    refetchFields,
    localSegments,
    dirtySegmentIds,
    pendingSegmentDeletes,
    localRules,
    dirtyRuleIds,
    pendingRuleDeletes,
    selectedSegmentId,
    createFormSegmentAsync,
    updateFormSegmentAsync,
    deleteFormSegmentAsync,
    createLogicRuleAsync,
    updateLogicRuleAsync,
    deleteLogicRuleAsync,
    refetchSegments,
    refetchRules,
  ]);

  const updateLocal = useCallback((id: string, patch: Partial<LocalField>) => {
    setLocalFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  const localFieldsRef = useRef(localFields);
  useEffect(() => {
    localFieldsRef.current = localFields;
  }, [localFields]);

  const maxLocalIndex = useCallback(
    () =>
      localFieldsRef.current.reduce((m, f) => {
        const v = parseIndex(f.index);
        return Number.isFinite(v) && v > m ? v : m;
      }, 0),
    [],
  );

  const updateManyLocal = useCallback((patches: Map<string, Partial<LocalField>>) => {
    if (patches.size === 0) return;
    setLocalFields((prev) =>
      prev.map((f) => {
        const patch = patches.get(f.id);
        return patch ? { ...f, ...patch } : f;
      }),
    );
    setDirtyIds((prev) => {
      const next = new Set(prev);
      for (const id of patches.keys()) next.add(id);
      return next;
    });
  }, []);

  const visibleSegments = useMemo(
    () =>
      localSegments
        .filter((s) => !pendingSegmentDeletes.has(s.id))
        .sort((a, b) => parseIndex(a.index) - parseIndex(b.index)),
    [localSegments, pendingSegmentDeletes],
  );

  const updateSegmentLocal = useCallback((id: string, patch: Partial<LocalSegment>) => {
    setLocalSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirtySegmentIds((prev) => new Set(prev).add(id));
  }, []);

  const handleAddSegment = useCallback(() => {
    const isFirst = visibleSegments.length === 0;
    const tempId = `new-seg-${Date.now()}`;
    const nextIndex = isFirst
      ? 1
      : Math.max(...visibleSegments.map((s) => parseIndex(s.index) || 0)) + 1;

    const created = {
      id: tempId,
      formId,
      title: isFirst ? "Segment 1" : `Segment ${visibleSegments.length + 1}`,
      description: null,
      index: formatIndex(nextIndex),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      _isNew: true,
    } as unknown as LocalSegment;

    setLocalSegments((prev) => [...prev, created]);
    setDirtySegmentIds((prev) => new Set(prev).add(tempId));

    if (isFirst) {
      const patches = new Map<string, Partial<LocalField>>();
      for (const field of localFieldsRef.current) {
        if (pendingDeletes.has(field.id)) continue;
        patches.set(field.id, { segmentId: tempId });
      }
      updateManyLocal(patches);
      toast.success("Existing questions moved into Segment 1 — add another to branch between them");
    }

    setSelectedSegmentId(tempId);
  }, [visibleSegments, formId, pendingDeletes, updateManyLocal]);

  const handleMoveSegment = useCallback(
    (id: string, direction: "up" | "down") => {
      const at = visibleSegments.findIndex((s) => s.id === id);
      if (at === -1) return;
      const swapWith = direction === "up" ? at - 1 : at + 1;
      if (swapWith < 0 || swapWith >= visibleSegments.length) return;

      const a = visibleSegments[at]!;
      const b = visibleSegments[swapWith]!;
      updateSegmentLocal(a.id, { index: String(b.index) });
      updateSegmentLocal(b.id, { index: String(a.index) });
    },
    [visibleSegments, updateSegmentLocal],
  );

  const handleDeleteSegment = useCallback(
    (id: string) => {
      const at = visibleSegments.findIndex((s) => s.id === id);
      const adoptive = at > 0 ? visibleSegments[at - 1] : visibleSegments[at + 1];
      const adoptiveId = adoptive?.id ?? null;

      const patches = new Map<string, Partial<LocalField>>();
      for (const field of localFieldsRef.current) {
        if (field.segmentId === id) {
          patches.set(field.id, { segmentId: adoptiveId });
        }
      }
      if (patches.size > 0) updateManyLocal(patches);

      setLocalRules((prev) => prev.filter((r) => r.targetSegmentId !== id || r._isNew === true));
      setPendingRuleDeletes((prev) => {
        const next = new Set(prev);
        for (const rule of localRules) {
          if (rule.targetSegmentId === id && !rule._isNew) next.add(rule.id);
        }
        return next;
      });

      setPendingSegmentDeletes((prev) => new Set(prev).add(id));
      setDirtySegmentIds((prev) => new Set(prev).add(id));
      setSelectedSegmentId((prev) => (prev === id ? null : prev));
      toast("Segment removed — save to confirm", { duration: 2000 });
    },
    [visibleSegments, localRules, updateManyLocal],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const [branchingFieldId, setBranchingFieldId] = useState<string | null>(null);

  const rulesForField = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return [] as FlowRule[];
      return localRules
        .filter((r) => r.fieldId === fieldId && !pendingRuleDeletes.has(r.id))
        .sort((a, b) => parseIndex(a.index) - parseIndex(b.index)) as unknown as FlowRule[];
    },
    [localRules, pendingRuleDeletes],
  );

  const markRuleDirty = useCallback((id: string) => {
    setDirtyRuleIds((prev) => new Set(prev).add(id));
  }, []);

  const handleAddRule = useCallback(() => {
    const fieldId = branchingFieldId;
    if (!fieldId) return;

    const tempId = `new-rule-${Date.now()}`;
    const siblings = localRules.filter((r) => r.fieldId === fieldId);
    const nextIndex =
      siblings.length === 0 ? 1 : Math.max(...siblings.map((r) => parseIndex(r.index) || 0)) + 1;

    const created = {
      id: tempId,
      formId,
      fieldId,
      match: "ALL",
      conditions: [
        {
          id: `new-cond-${Date.now()}`,
          ruleId: tempId,
          fieldId,
          operator: "EQUALS",
          value: "",
          index: "1",
        },
      ],
      action: "JUMP_TO_FIELD",
      targetFieldId: null,
      targetSegmentId: null,
      elseAction: null,
      elseTargetFieldId: null,
      elseTargetSegmentId: null,
      index: formatIndex(nextIndex),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      _isNew: true,
    } as unknown as LocalRule;

    setLocalRules((prev) => [...prev, created]);
    markRuleDirty(tempId);
  }, [branchingFieldId, localRules, formId, markRuleDirty]);

  const handleUpdateRule = useCallback(
    (id: string, patch: Partial<FlowRule>) => {
      setLocalRules(
        (prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) as unknown as LocalRule[],
      );
      markRuleDirty(id);
    },
    [markRuleDirty],
  );

  const handleDeleteRule = useCallback(
    (id: string) => {
      const rule = localRules.find((r) => r.id === id);
      if (rule?._isNew) {
        setLocalRules((prev) => prev.filter((r) => r.id !== id));
        setDirtyRuleIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      setPendingRuleDeletes((prev) => new Set(prev).add(id));
      markRuleDirty(id);
    },
    [localRules, markRuleDirty],
  );

  const handleDuplicateRule = useCallback(
    (id: string) => {
      const source = localRules.find((r) => r.id === id);
      if (!source) return;

      const tempId = `new-rule-${Date.now()}`;
      const siblings = localRules.filter((r) => r.fieldId === source.fieldId);
      const nextIndex = Math.max(...siblings.map((r) => parseIndex(r.index) || 0)) + 1;

      const copy = {
        ...source,
        id: tempId,
        index: formatIndex(nextIndex),
        version: 0,
        _isNew: true,
        conditions: (source.conditions ?? []).map((condition: FlowCondition, i: number) => ({
          ...condition,
          id: `new-cond-${Date.now()}-${i}`,
          ruleId: tempId,
        })),
      } as unknown as LocalRule;

      setLocalRules((prev) => [...prev, copy]);
      markRuleDirty(tempId);
    },
    [localRules, markRuleDirty],
  );

  const handleMoveRule = useCallback(
    (id: string, direction: "up" | "down") => {
      const source = localRules.find((r) => r.id === id);
      if (!source) return;

      const siblings = rulesForField(source.fieldId);
      const at = siblings.findIndex((r) => r.id === id);
      const swapWith = direction === "up" ? at - 1 : at + 1;
      if (at === -1 || swapWith < 0 || swapWith >= siblings.length) return;

      const a = siblings[at]!;
      const b = siblings[swapWith]!;
      handleUpdateRule(a.id, { index: String(b.index) });
      handleUpdateRule(b.id, { index: String(a.index) });
    },
    [localRules, rulesForField, handleUpdateRule],
  );

  const handleAddCondition = useCallback(
    (ruleId: string) => {
      setLocalRules((prev) =>
        prev.map((r) => {
          if (r.id !== ruleId) return r;
          const conditions = (r.conditions ?? []) as FlowCondition[];
          const nextIndex =
            conditions.length === 0
              ? 1
              : Math.max(...conditions.map((c) => parseIndex(c.index) || 0)) + 1;
          return {
            ...r,
            conditions: [
              ...conditions,
              {
                id: `new-cond-${Date.now()}`,
                ruleId,
                fieldId: r.fieldId,
                operator: "EQUALS",
                value: "",
                index: String(nextIndex),
              },
            ],
          } as unknown as LocalRule;
        }),
      );
      markRuleDirty(ruleId);
    },
    [markRuleDirty],
  );

  const handleUpdateCondition = useCallback(
    (ruleId: string, conditionId: string, patch: Partial<FlowCondition>) => {
      setLocalRules((prev) =>
        prev.map((r) =>
          r.id === ruleId
            ? ({
                ...r,
                conditions: ((r.conditions ?? []) as FlowCondition[]).map((c) =>
                  c.id === conditionId ? { ...c, ...patch } : c,
                ),
              } as unknown as LocalRule)
            : r,
        ),
      );
      markRuleDirty(ruleId);
    },
    [markRuleDirty],
  );

  const handleDeleteCondition = useCallback(
    (ruleId: string, conditionId: string) => {
      setLocalRules((prev) =>
        prev.map((r) =>
          r.id === ruleId
            ? ({
                ...r,
                conditions: ((r.conditions ?? []) as FlowCondition[]).filter(
                  (c) => c.id !== conditionId,
                ),
              } as unknown as LocalRule)
            : r,
        ),
      );
      markRuleDirty(ruleId);
    },
    [markRuleDirty],
  );

  const [view, setView] = useState<BuilderView>("canvas");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "canvas" || saved === "outline") setView(saved);
      else if (saved === "list") setView("outline");
    } catch {
      /* Safe fallback */
    }
  }, []);

  const handleViewChange = useCallback((next: BuilderView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* Safe fallback */
    }
  }, []);

  const [label, setLabel] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [description, setDescription] = useState("");
  const [optionsList, setOptionsList] = useState<string[]>([]);

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    const visible = localFields
      .filter((f) => !pendingDeletes.has(f.id))
      .filter((f) => selectedSegmentId === null || f.segmentId === selectedSegmentId)
      .sort((a, b) => {
        const d = parseIndex(a.index) - parseIndex(b.index);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]));
      return visible.map((field, idx) => {
        const existing = prevById.get(field.id);
        if (existing) {
          return { ...existing, data: { field } };
        }
        const p = (typeof field.options === "object" && field.options ? (field.options as any) : {})
          .position || { x: 300, y: idx * 200 + 80 };
        return {
          id: field.id,
          type: "formField",
          position: p,
          data: { field },
        };
      });
    });
    const mappedEdges: Edge[] = [];
    const onCanvas = new Set(visible.map((f) => f.id));

    for (let i = 0; i < visible.length - 1; i++) {
      const s = visible[i];
      const t = visible[i + 1];
      if (s && t)
        mappedEdges.push({
          id: `e-${s.id}-${t.id}`,
          source: s.id,
          target: t.id,
          animated: true,
          style: {
            stroke: "#f66f00",
            strokeWidth: 1.5,
            strokeOpacity: 0.55,
            strokeDasharray: "4,4",
          },
        });
    }

    const targetOf = (
      action: string | null | undefined,
      fieldTarget: string | null | undefined,
      segmentTarget: string | null | undefined,
    ): string | null => {
      if (action === "JUMP_TO_FIELD") return fieldTarget ?? null;
      if (action === "JUMP_TO_SEGMENT" && segmentTarget) {
        return visible.find((f) => f.segmentId === segmentTarget)?.id ?? null;
      }
      return null;
    };

    for (const rule of localRules) {
      if (pendingRuleDeletes.has(rule.id)) continue;
      if (!onCanvas.has(rule.fieldId)) continue;

      const conditionCount = rule.conditions?.length ?? 0;
      const edgeLabel =
        conditionCount === 0
          ? "incomplete"
          : conditionCount === 1
            ? "if"
            : `if ${rule.match === "ANY" ? "any" : "all"} ${conditionCount}`;

      const sides: Array<{ suffix: string; target: string | null; label: string; solid: boolean }> =
        [
          {
            suffix: "then",
            target: targetOf(rule.action, rule.targetFieldId, rule.targetSegmentId),
            label: edgeLabel,
            solid: true,
          },
          {
            suffix: "else",
            target: targetOf(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId),
            label: "otherwise",
            solid: false,
          },
        ];

      for (const side of sides) {
        if (!side.target || !onCanvas.has(side.target) || side.target === rule.fieldId) continue;
        mappedEdges.push({
          id: `branch-${rule.id}-${side.suffix}`,
          source: rule.fieldId,
          target: side.target,
          label: side.label,
          labelStyle: { fontSize: 10, fontFamily: "monospace" },
          labelBgStyle: { fill: "var(--cf-cream)" },
          style: side.solid
            ? { stroke: "#1a1d29", strokeWidth: 2 }
            : { stroke: "#1a1d29", strokeWidth: 1.5, strokeDasharray: "6,3", strokeOpacity: 0.7 },
        });
      }
    }

    setEdges(mappedEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFields, pendingDeletes, selectedSegmentId, localRules, pendingRuleDeletes]);

  const segmentQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const field of localFields) {
      if (pendingDeletes.has(field.id) || !field.segmentId) continue;
      counts[field.segmentId] = (counts[field.segmentId] ?? 0) + 1;
    }
    return counts;
  }, [localFields, pendingDeletes]);

  const unassignedQuestionCount = useMemo(
    () => localFields.filter((f) => !pendingDeletes.has(f.id) && !f.segmentId).length,
    [localFields, pendingDeletes],
  );

  const branchTargetSegments = useMemo(
    () =>
      visibleSegments.map((s, i) => ({
        id: s.id,
        label: `${i + 1}. ${s.title?.trim() || `Segment ${i + 1}`}`,
      })),
    [visibleSegments],
  );

  const activeRuleCount = useMemo(
    () => localRules.filter((r) => !pendingRuleDeletes.has(r.id)).length,
    [localRules, pendingRuleDeletes],
  );

  const draftFlow = useMemo(
    () =>
      buildFlow(
        localFields.filter((f) => !pendingDeletes.has(f.id)) as unknown as FlowField[],
        visibleSegments as unknown as FlowSegment[],
        localRules.filter((r) => !pendingRuleDeletes.has(r.id)) as unknown as FlowRule[],
      ),
    [localFields, pendingDeletes, visibleSegments, localRules, pendingRuleDeletes],
  );

  const flowLabels: FlowLabels = useMemo(() => {
    const positionOf = new Map(draftFlow.order.map((f, i) => [f.id, i + 1]));
    return {
      fieldLabel: (fieldId) => {
        const field = draftFlow.fieldById.get(fieldId);
        if (!field) return "a deleted question";
        const name =
          field.label?.trim() || `Untitled ${field.type.replace("_", " ").toLowerCase()}`;
        return `Q${positionOf.get(fieldId) ?? "?"} ${name}`;
      },
      segmentLabel: (segmentId) => {
        const at = draftFlow.segments.findIndex((s) => s.id === segmentId);
        if (at === -1) return "a deleted segment";
        return draftFlow.segments[at]?.title?.trim() || `Segment ${at + 1}`;
      },
    };
  }, [draftFlow]);

  const selectedFieldRuleSummaries = useMemo(
    () => rulesForField(selectedNodeId).map((rule) => describeRule(rule, flowLabels)),
    [rulesForField, selectedNodeId, flowLabels],
  );

  const selectedFieldIncompleteRules = useMemo(
    () => rulesForField(selectedNodeId).filter((rule) => !isRuleComplete(rule)).length,
    [rulesForField, selectedNodeId],
  );

  const isSelectedFieldLastInSegment = useMemo(() => {
    if (!selectedNodeId) return false;
    const selected = localFields.find((f) => f.id === selectedNodeId);
    if (!selected?.segmentId) return false;
    const siblings = localFields
      .filter((f) => !pendingDeletes.has(f.id) && f.segmentId === selected.segmentId)
      .sort((a, b) => parseIndex(a.index) - parseIndex(b.index));
    return siblings[siblings.length - 1]?.id === selectedNodeId;
  }, [localFields, pendingDeletes, selectedNodeId]);

  const selectedField = useMemo(
    () => localFields.find((f) => f.id === selectedNodeId) ?? null,
    [localFields, selectedNodeId],
  );

  useEffect(() => {
    if (selectedField) {
      setLabel(selectedField.label);
      setPlaceholder(selectedField.placeholder || "");
      setIsRequired(selectedField.isRequired);
      setDescription(selectedField.description || "");
      setOptionsList(getFieldOptionsArray(selectedField));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField?.id]);

  const nextSegmentId = useCallback(
    () => selectedSegmentId ?? visibleSegments[visibleSegments.length - 1]?.id ?? null,
    [selectedSegmentId, visibleSegments],
  );

  const onDragStart = (event: React.DragEvent, type: string) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const tempId = `new-${Date.now()}`;
      const nextIndex = formatIndex(maxLocalIndex() + 1);
      const newField = {
        id: tempId,
        formId,
        segmentId: nextSegmentId(),
        label: "",
        labelKey: "field",
        placeholder: null,
        isRequired: false,
        index: nextIndex,
        type: type as any,
        options: { position },
        description: null,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _isNew: true,
      };
      setLocalFields((prev) => [...prev, newField]);
      setDirtyIds((prev) => new Set(prev).add(tempId));
      setSelectedNodeId(tempId);
    },
    [screenToFlowPosition, formId, maxLocalIndex, nextSegmentId],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      const currentField = localFields.find((f) => f.id === node.id);
      if (!currentField) return;

      const currentOpts =
        typeof currentField.options === "object" && currentField.options
          ? (currentField.options as Record<string, any>)
          : {};
      const positionPatch = { options: { ...currentOpts, position: node.position } };

      const visible = localFields.filter((f) => !pendingDeletes.has(f.id));

      const livePos = new Map(nodes.map((n) => [n.id, n.position]));
      livePos.set(node.id, node.position);
      const posOf = (f: LocalField) =>
        livePos.get(f.id) ??
        ((f.options as any)?.position as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };

      const ordered = [...visible].sort((a, b) => {
        const pa = posOf(a);
        const pb = posOf(b);
        if (pa.y !== pb.y) return pa.y - pb.y;
        if (pa.x !== pb.x) return pa.x - pb.x;
        return parseIndex(a.index) - parseIndex(b.index);
      });

      const at = ordered.findIndex((f) => f.id === node.id);
      if (at === -1) {
        updateLocal(node.id, positionPatch);
        return;
      }

      const before = at > 0 ? parseIndex(ordered[at - 1]!.index) : null;
      const after = at < ordered.length - 1 ? parseIndex(ordered[at + 1]!.index) : null;
      const current = parseIndex(currentField.index);

      if (isBetween(current, before, after)) {
        updateLocal(node.id, positionPatch);
        return;
      }

      const next = indexBetween(before, after);
      if (next !== null) {
        updateLocal(node.id, { ...positionPatch, index: next });
        return;
      }

      const base = maxLocalIndex() + 1;
      const patches = new Map<string, Partial<LocalField>>();
      ordered.forEach((f, i) => {
        patches.set(f.id, { index: formatIndex(base + i) });
      });
      patches.set(node.id, { ...patches.get(node.id), ...positionPatch });
      updateManyLocal(patches);
    },
    [localFields, pendingDeletes, nodes, updateLocal, updateManyLocal, maxLocalIndex],
  );

  const handleRequiredChange = useCallback(
    (checked: boolean) => {
      if (!selectedField) return;
      setIsRequired(checked);
      updateLocal(selectedField.id, { isRequired: checked });
    },
    [selectedField, updateLocal],
  );

  const handleDeleteField = useCallback(() => {
    if (!selectedNodeId) return;
    setPendingDeletes((prev) => new Set(prev).add(selectedNodeId));
    setDirtyIds((prev) => new Set(prev).add(selectedNodeId));
    setSelectedNodeId(null);
    toast("Field removed — save to confirm", { duration: 2000 });
  }, [selectedNodeId]);

  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  const visibleSortedFields = useMemo(
    () =>
      localFields
        .filter((f) => !pendingDeletes.has(f.id))
        .filter((f) => selectedSegmentId === null || f.segmentId === selectedSegmentId)
        .sort((a, b) => {
          const d = parseIndex(a.index) - parseIndex(b.index);
          return d !== 0 ? d : a.id.localeCompare(b.id);
        }),
    [localFields, pendingDeletes, selectedSegmentId],
  );

  const handleMobileTapField = useCallback((id: string) => {
    setSelectedNodeId(id);
    setMobileEditorOpen(true);
  }, []);

  const handleCloseMobileEditor = useCallback(() => {
    setMobileEditorOpen(false);
    setSelectedNodeId(null);
  }, []);

  const handleMobileMove = useCallback(
    (id: string, direction: "up" | "down") => {
      const list = visibleSortedFields;
      const i = list.findIndex((f) => f.id === id);
      if (i === -1) return;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;

      const beforeField = direction === "up" ? list[j - 1] : list[j];
      const afterField = direction === "up" ? list[j] : list[j + 1];

      const next = indexBetween(
        beforeField ? parseIndex(beforeField.index) : null,
        afterField ? parseIndex(afterField.index) : null,
      );

      if (next !== null) {
        updateLocal(id, { index: next });
        return;
      }

      const reordered = [...list];
      const [moved] = reordered.splice(i, 1);
      reordered.splice(j, 0, moved!);

      const base = maxLocalIndex() + 1;
      const patches = new Map<string, Partial<LocalField>>();
      reordered.forEach((f, k) => {
        patches.set(f.id, { index: formatIndex(base + k) });
      });
      updateManyLocal(patches);
    },
    [visibleSortedFields, updateLocal, updateManyLocal, maxLocalIndex],
  );

  const appendField = useCallback(
    (type: string) => {
      const last = visibleSortedFields[visibleSortedFields.length - 1];
      const nextIndex = formatIndex(maxLocalIndex() + 1);

      const lastPos = (last?.options as any)?.position as { x: number; y: number } | undefined;
      const position = lastPos
        ? { x: lastPos.x, y: lastPos.y + 200 }
        : { x: 300, y: visibleSortedFields.length * 200 + 80 };

      const tempId = `new-${Date.now()}`;
      const newField: LocalField = {
        id: tempId,
        formId,
        segmentId: nextSegmentId(),
        label: "",
        labelKey: "field",
        placeholder: null,
        index: nextIndex,
        isRequired: false,
        type: type as any,
        options: { position } as any,
        description: null,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _isNew: true,
      };
      setLocalFields((prev) => [...prev, newField]);
      setDirtyIds((prev) => new Set(prev).add(tempId));
      setSelectedNodeId(tempId);
    },
    [visibleSortedFields, formId, maxLocalIndex, nextSegmentId],
  );

  const handleMobileAddField = useCallback(
    (type: string) => {
      appendField(type);
      setMobileAddOpen(false);
      setMobileEditorOpen(true);
    },
    [appendField],
  );

  return {
    formId,
    reactFlowWrapper,
    form,
    formLoading,
    refetchForm,
    fieldsLoading,
    refetchFields,
    publishPending,
    deletePending,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showShareDialog,
    setShowShareDialog,
    showSettingsDialog,
    setShowSettingsDialog,
    localFields,
    setLocalFields,
    setDirtyIds,
    setPendingDeletes,
    localSegments,
    setLocalSegments,
    setDirtySegmentIds,
    setPendingSegmentDeletes,
    localRules,
    setLocalRules,
    setDirtyRuleIds,
    setPendingRuleDeletes,
    selectedSegmentId,
    setSelectedSegmentId,
    mobileSegmentsOpen,
    setMobileSegmentsOpen,
    isSaving,
    setIsSaving,
    justSaved,
    setJustSaved,
    showUnsavedDialog,
    setShowUnsavedDialog,
    pendingNavRef,
    isDirtyRef,
    isDirty,
    handleSave,
    updateLocal,
    maxLocalIndex,
    updateManyLocal,
    visibleSegments,
    updateSegmentLocal,
    handleAddSegment,
    handleMoveSegment,
    handleDeleteSegment,
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId,
    isLocked,
    setIsLocked,
    branchingFieldId,
    setBranchingFieldId,
    rulesForField,
    markRuleDirty,
    handleAddRule,
    handleUpdateRule,
    handleDeleteRule,
    handleDuplicateRule,
    handleMoveRule,
    handleAddCondition,
    handleUpdateCondition,
    handleDeleteCondition,
    view,
    setView,
    handleViewChange,
    label,
    setLabel,
    placeholder,
    setPlaceholder,
    isRequired,
    setIsRequired,
    description,
    setDescription,
    optionsList,
    setOptionsList,
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
    onDragStart,
    onDragOver,
    onDrop,
    onNodeClick,
    onPaneClick,
    onNodeDragStop,
    handleRequiredChange,
    handleDeleteField,
    mobileAddOpen,
    setMobileAddOpen,
    mobileEditorOpen,
    setMobileEditorOpen,
    visibleSortedFields,
    handleMobileTapField,
    handleCloseMobileEditor,
    handleMobileMove,
    appendField,
    handleMobileAddField,
    segmentQuestionCounts,
    unassignedQuestionCount,
    branchTargetSegments,
    activeRuleCount,
    draftFlow,
    flowLabels,
    selectedFieldRuleSummaries,
    selectedFieldIncompleteRules,
    isSelectedFieldLastInSegment,
    selectedField,
    publishForm,
    deleteFormAsync,
  };
}
