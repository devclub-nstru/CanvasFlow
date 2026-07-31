"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Edge,
  Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronDown, ChevronUp, Layers, Lock, Maximize2, Minus, Plus, Unlock } from "lucide-react";
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
import { VerticalScale } from "~/components/Scale";
import { nodeTypes, getFieldOptionsArray } from "~/components/builder/FormFieldNode";
import { FieldSidebar } from "~/components/builder/FieldSidebar";
import { FieldInspector } from "~/components/builder/FieldInspector";
import { BuilderHeader, type BuilderView } from "~/components/builder/BuilderHeader";
import { UnsavedDialog } from "~/components/builder/UnsavedDialog";
import { DeleteFormDialog } from "~/components/builder/DeleteFormDialog";
import { FieldOutline } from "~/components/builder/FieldOutline";
import { SegmentPanel } from "~/components/builder/SegmentPanel";
import { LogicDialog } from "~/components/builder/LogicDialog";
import {
  buildFlow,
  type FlowCondition,
  type FlowRule,
  type FlowField,
  type FlowSegment,
} from "~/lib/form-flow";
import { describeRule, isRuleComplete, type FlowLabels } from "~/lib/form-logic";
import { MobileAddFieldSheet } from "~/components/builder/mobile/MobileAddFieldSheet";
import { MobileFieldEditorSheet } from "~/components/builder/mobile/MobileFieldEditorSheet";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";
import { FormSettingsDialog } from "~/components/builder/FormSettingsDialog";

const VIEW_STORAGE_KEY = "canvasflow:builder-view";

function BuilderCanvas() {
  const params = useParams();
  const router = useRouter();
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

  /* ─── Local draft state ────────────────────────────────────────────── */
  type LocalField = NonNullable<typeof fields>[number] & { _isNew?: boolean };
  const [localFields, setLocalFields] = useState<LocalField[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  /* Segments and branching rules share the field draft model: edited locally,
   * persisted together on Save. They can't be saved eagerly instead, because
   * the three are interdependent — a question needs its segment's real id, and
   * a rule needs its question's real id, and both are temporary until saved.
   * Keeping all three in one draft means `handleSave` can resolve those ids in
   * one pass rather than the editor hitting "you must save first". */
  type LocalSegment = NonNullable<typeof segments>[number] & { _isNew?: boolean };
  const [localSegments, setLocalSegments] = useState<LocalSegment[]>([]);
  const [dirtySegmentIds, setDirtySegmentIds] = useState<Set<string>>(new Set());
  const [pendingSegmentDeletes, setPendingSegmentDeletes] = useState<Set<string>>(new Set());

  type LocalRule = NonNullable<typeof logicRules>[number] & { _isNew?: boolean };
  const [localRules, setLocalRules] = useState<LocalRule[]>([]);
  const [dirtyRuleIds, setDirtyRuleIds] = useState<Set<string>>(new Set());
  const [pendingRuleDeletes, setPendingRuleDeletes] = useState<Set<string>>(new Set());

  /** Which segment the canvas/outline is filtered to. null = show everything. */
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  /** Whether the phone layout's segment list is expanded. Collapsed by default
   *  so it doesn't push the question outline off the screen. */
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

  // Seeded once, like localFields. `dirty` guards rather than `length === 0`
  // because an empty segment list is the normal state for most forms, and
  // re-seeding on every refetch would wipe an in-progress split.
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

  /* ─── Save all pending changes ─────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const tempIdToRealId = new Map<string, string>();
      const updatedVersionById = new Map<string, number>();

      /* ── Phase 1: segments ──────────────────────────────────────────────
       *
       * Ahead of fields because a question's `segmentId` has to point at a
       * row that exists. New segments are created one at a time rather than
       * through Promise.all: `createFormSegment` reads MAX(index) inside a
       * transaction, and parallel calls would either collide on
       * UNIQUE(form_id, index) or serialise on the row lock anyway.
       *
       * `adoptUnassignedFields: false` because the builder has already
       * assigned questions to segments in its own draft — letting the server
       * also create a first segment would duplicate it. */
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

      /** Segment ids as the server knows them. */
      const resolveSegmentId = (id: string | null | undefined): string | null => {
        if (!id) return null;
        return tempSegmentIdToRealId.get(id) ?? id;
      };

      /* ── Phase 2: fields ─────────────────────────────────────────────── */
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

      /* ── Phase 3: branching rules and their conditions ───────────────────
       *
       * Last, because a rule references up to five other rows — the question
       * it triggers on, one per condition, and its two jump targets — any of
       * which may have only just been assigned a real id.
       *
       * Incomplete rules are skipped rather than sent. The server (and the
       * CHECK constraints behind it) would reject a jump with no destination,
       * and failing the whole save over a half-filled branch the author is
       * still working on would be worse than leaving it unsaved. The dialog
       * and the inspector both already flag those. */
      const resolveFieldId = (id: string | null | undefined): string | null => {
        if (!id) return null;
        return tempIdToRealId.get(id) ?? id;
      };

      /** A rule as the server needs to see it: every local/temporary id
       *  swapped for the real one now that fields and segments exist. */
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

      /** Saveable means: complete per the shared rule check, and every row it
       *  points at still exists after this save's deletions. */
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

      /* Segment deletions come after rule writes: deleting a segment cascades
       * away the rules that target it, so doing it earlier would race a rule
       * update against its own removal. */
      await Promise.all(
        localSegments
          .filter((s) => !s._isNew && pendingSegmentDeletes.has(s.id))
          .map((s) => deleteFormSegmentAsync({ id: s.id })),
      );

      // Rules and segments carry server-assigned ids and versions that the
      // local draft can't derive, so refetch rather than patch in place. The
      // field draft is still reconciled locally below to preserve canvas
      // node positions and selection.
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
            // A field created against a brand-new segment still holds the
            // temporary segment id locally; swap it for the real one so a
            // second save doesn't try to re-point it.
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
        // All three have to come back together. Reloading only fields would
        // leave segment assignments and branch rules pointing at ids the
        // refreshed field list may no longer contain.
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
          setPendingSegmentDeletes(new Set());
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

  /* ─── Segments ─────────────────────────────────────────────────────── */

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

  /**
   * Add a segment.
   *
   * The first one is the interesting case. A form with no segments is one
   * continuous list, so "split into segments" has to put the questions that
   * already exist somewhere — otherwise they'd sit outside every segment and
   * the editor would be looking at a form whose contents aren't on any page.
   * So the first click creates "Segment 1" and moves everything into it; the
   * next click adds an empty "Segment 2" to branch into.
   */
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

      // Swapping the two index values is a two-row write and can't collide,
      // whereas computing a value between the neighbour and its neighbour
      // would need a third read. Segment lists are short; this is enough.
      const a = visibleSegments[at]!;
      const b = visibleSegments[swapWith]!;
      updateSegmentLocal(a.id, { index: String(b.index) });
      updateSegmentLocal(b.id, { index: String(a.index) });
    },
    [visibleSegments, updateSegmentLocal],
  );

  /**
   * Remove a segment from the draft.
   *
   * Its questions are re-pointed at the previous segment here, mirroring what
   * the service does on the server, so the canvas doesn't briefly show them
   * flung to the front of the form before the save lands.
   */
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

      // Rules pointing at this segment would become jumps to nowhere.
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

  /* ─── React Flow state ─────────────────────────────────────────────── */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  /* ─── Branching ────────────────────────────────────────────────────────
   *
   * Rules trigger off the selected question, so these sit below the React Flow
   * state that owns the selection. Conditions are edited in place on their
   * rule rather than as their own draft collection: they only exist inside a
   * rule, are always saved with it, and giving them a separate dirty set would
   * mean tracking two things that can never disagree. */

  /** Which question's branching the dialog is showing, if any. */
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

    /* Opens with one condition already reading this question's own answer,
     * because that's the branch nine times out of ten and an empty rule gives
     * the author nothing to react to. Targets start unset and the rule reads
     * as incomplete until they're chosen. */
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
      // A rule that was never saved can just disappear; there's nothing on the
      // server to tell about it, and keeping it in a pending-delete set would
      // have `handleSave` try to delete an id the server has never seen.
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
        // Fresh condition ids: the originals belong to rows on the server, and
        // reusing them would make the copy look like an edit of the original.
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

      // Swapping the two index values is a two-row write that can't collide.
      // Rule order decides which branch is checked first, so it has to be
      // adjustable, and these lists are short.
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
                // Defaults to the trigger question, the most likely thing the
                // author wants to test next.
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
      /* Private mode / storage disabled — the default is fine. */
    }
  }, []);

  const handleViewChange = useCallback((next: BuilderView) => {
    setView(next);

    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* Non-fatal: the switch still applies for this session. */
    }
  }, []);

  // Inspector controlled inputs
  const [label, setLabel] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [description, setDescription] = useState("");
  const [optionsList, setOptionsList] = useState<string[]>([]);

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    const visible = localFields
      .filter((f) => !pendingDeletes.has(f.id))
      // Filtered to one segment when the editor picks one. A segmented form
      // is several short pages, and showing every page's questions on one
      // canvas is what made segments hard to read in the first place.
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

    // The default fall-through order: dashed and faint, because it's what
    // happens when no rule matches rather than something the editor drew.
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

    /* Branch edges. Drawn solid and labelled with their condition, so the
     * canvas shows the routes a respondent can actually take instead of a
     * straight line that the rules contradict. Only edges whose endpoints are
     * both on the canvas are drawn — a jump into a different segment has no
     * visible target while the view is filtered, and React Flow would drop a
     * dangling edge anyway. */
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
      // The label has to fit on an edge, so it counts rather than recites.
      // The full sentence lives in the inspector and the dialog.
      const label =
        conditionCount === 0
          ? "incomplete"
          : conditionCount === 1
            ? "if"
            : `if ${rule.match === "ANY" ? "any" : "all"} ${conditionCount}`;

      // The two sides get their own edge, so a fork reads as a fork.
      const sides: Array<{ suffix: string; target: string | null; label: string; solid: boolean }> =
        [
          {
            suffix: "then",
            target: targetOf(rule.action, rule.targetFieldId, rule.targetSegmentId),
            label,
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

  /* Counts for the segment panel, and the two option lists the branching
   * editor needs. Derived from the draft so a question moved between
   * segments is reflected before the save lands. */
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

  /** Branching rules still standing in the draft. Drives the layout advice in
   *  settings, where a branching form can't be shown on a single page. */
  const activeRuleCount = useMemo(
    () => localRules.filter((r) => !pendingRuleDeletes.has(r.id)).length,
    [localRules, pendingRuleDeletes],
  );

  /**
   * The draft as a Flow — the same structure the public renderer walks.
   *
   * Built from local state, not the server's, so the dialog's pickers, its
   * plain-English summaries and its warnings all describe the form as it
   * stands in the editor rather than as it was last saved. It also means the
   * builder and the respondent are reading one implementation of the routing
   * rules, so a branch can't preview one way and behave another.
   *
   * Never filtered by the selected segment: the point of a branch is to leave
   * the segment you're in, so every question has to be offerable as a target.
   */
  const draftFlow = useMemo(
    () =>
      buildFlow(
        localFields.filter((f) => !pendingDeletes.has(f.id)) as unknown as FlowField[],
        visibleSegments as unknown as FlowSegment[],
        localRules.filter((r) => !pendingRuleDeletes.has(r.id)) as unknown as FlowRule[],
      ),
    [localFields, pendingDeletes, visibleSegments, localRules, pendingRuleDeletes],
  );

  /** Numbered names, shared by the dialog, the summaries and the warnings so
   *  a question is called the same thing everywhere. */
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

  /* Inspector summary for the selected question: one sentence per branch, plus
   * a count of the ones that aren't finished. */
  const selectedFieldRuleSummaries = useMemo(
    () => rulesForField(selectedNodeId).map((rule) => describeRule(rule, flowLabels)),
    [rulesForField, selectedNodeId, flowLabels],
  );

  const selectedFieldIncompleteRules = useMemo(
    () => rulesForField(selectedNodeId).filter((rule) => !isRuleComplete(rule)).length,
    [rulesForField, selectedNodeId],
  );

  /** Whether the selected question closes out its segment — the position
   *  where a segment-level branch belongs, so the editor can say so. */
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

  /**
   * Which segment a newly added question belongs to.
   *
   * Shared by every add path, because they had drifted: dropping onto the
   * canvas assigned the selected segment while adding from the outline left
   * `segmentId` undefined. Since both the canvas and the outline are filtered
   * by the selected segment, and adding a segment selects it, a question added
   * from the outline right after creating a segment was filtered straight out
   * of the list it was added to — it existed in the draft and was invisible,
   * which reads as the button doing nothing.
   *
   * The selected segment wins when the view is filtered to one. Otherwise the
   * last segment, so a question added to an unfiltered segmented form lands at
   * the end rather than outside every page.
   */
  const nextSegmentId = useCallback(
    () => selectedSegmentId ?? visibleSegments[visibleSegments.length - 1]?.id ?? null,
    [selectedSegmentId, visibleSegments],
  );

  /* ─── Drag & Drop ──────────────────────────────────────────────────── */
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
        // Same segment filter the canvas applies, so the outline and the
        // canvas always agree about what's on screen.
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
        // Same assignment the canvas drop uses. Omitting it was the bug: the
        // question landed outside every segment and the outline's segment
        // filter hid it immediately.
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

  if (formLoading || fieldsLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-(--cf-cream)">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2"
            style={{ borderColor: "var(--cf-line)", borderTopColor: "var(--cf-orange)" }}
          />
          <span className="cf-meta">Loading canvas</span>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-(--cf-cream)">
        <div className="text-center space-y-4 max-w-sm">
          <p className="cf-meta">Not found</p>
          <h3 className="cf-display text-[26px] leading-tight uppercase">Form not found</h3>
          <Link
            href="/dashboard/sketches"
            className="cf-btn cf-raised cf-press h-10 px-5 text-[13px]"
          >
            Back to forms
          </Link>
        </div>
      </div>
    );
  }

  if (form.role === "viewer") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-(--cf-cream) p-4 text-center">
        <div className="cf-panel cf-raised w-full max-w-sm space-y-4 p-7">
          <p className="cf-meta" style={{ color: "var(--cf-orange)" }}>
            No edit access
          </p>
          <h3 className="cf-display text-[22px] leading-snug text-(--cf-ink)">
            You don&apos;t have access to edit this form
          </h3>
          <p className="text-[13.5px] text-(--cf-ink-soft) leading-relaxed">
            You only have viewer access to &ldquo;{form.title}&rdquo;. You can view its submissions
            and analytics, but you cannot make changes to the fields.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href={`/dashboard/analytics?form=${formId}`}
              className="cf-btn cf-raised cf-press h-10 px-5 text-[13px]"
            >
              View analytics
            </Link>
            <Link href="/dashboard/sketches" className="cf-btn-outline h-10 px-5 text-[13px]">
              Back to studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-(--cf-cream) text-(--cf-ink)">
      <BuilderHeader
        form={form}
        formId={formId}
        isDirty={isDirty}
        isSaving={isSaving}
        justSaved={justSaved}
        publishPending={publishPending}
        handleSave={handleSave}
        setShowDeleteConfirm={setShowDeleteConfirm}
        publishForm={publishForm}
        pendingNavRef={pendingNavRef}
        setShowUnsavedDialog={setShowUnsavedDialog}
        onPublishSuccess={() => {
          void refetchForm();
        }}
        onShare={() => setShowShareDialog(true)}
        onSettings={() => setShowSettingsDialog(true)}
        view={view}
        onViewChange={handleViewChange}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <VerticalScale className="hidden shrink-0 xl:block" />

          {/* Palette and segment list share a column: both answer "what am I
              adding, and where does it go", and the segment filter has to be
              visible while dropping fields for the drop target to make
              sense. */}
          {/* Narrower at the lg breakpoint. At 1024px a fixed 256px here plus
              the 288px inspector left the canvas under 480px, which is not
              enough to read a field node in. Both rails widen again at xl. */}
          <div
            className="flex w-56 shrink-0 flex-col overflow-hidden border-r xl:w-64"
            style={{ borderRightColor: "var(--cf-line-strong)" }}
          >
            <SegmentPanel
              segments={visibleSegments}
              questionCounts={segmentQuestionCounts}
              unassignedCount={unassignedQuestionCount}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
              onAddSegment={handleAddSegment}
              onRenameSegment={(id, title) => updateSegmentLocal(id, { title })}
              onMoveSegment={handleMoveSegment}
              onDeleteSegment={handleDeleteSegment}
            />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <FieldSidebar
                onDragStart={onDragStart}
                onPick={view === "outline" ? appendField : undefined}
              />
            </div>
          </div>

          {view === "outline" ? (
            <main
              className="relative flex h-full flex-1 flex-col border-r bg-(--cf-cream)"
              style={{ borderRightColor: "var(--cf-line-strong)" }}
            >
              <FieldOutline
                fields={visibleSortedFields}
                onTapField={setSelectedNodeId}
                onMove={handleMobileMove}
                selectedId={selectedNodeId}
              />
            </main>
          ) : (
            <main
              ref={reactFlowWrapper}
              className="relative flex h-full flex-1 flex-col border-r bg-(--cf-cream)"
              style={{ borderRightColor: "var(--cf-line-strong)" }}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <div className="cf-pane-bar">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="cf-meta">Canvas</span>
                  <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
                    {visibleSortedFields.length}{" "}
                    {visibleSortedFields.length === 1 ? "field" : "fields"}
                  </span>
                </div>

                <button
                  onClick={() => setIsLocked(!isLocked)}
                  aria-pressed={isLocked}
                  title={isLocked ? "Unlock canvas" : "Lock canvas"}
                  className={`inline-flex h-5.5 shrink-0 cursor-pointer items-center gap-1.5 border px-2 font-mono text-[10px] tracking-wider uppercase transition-colors ${
                    isLocked
                      ? "border-(--cf-orange) text-(--cf-orange)"
                      : "border-(--cf-line-strong) text-(--cf-ink-soft) hover:text-(--cf-ink)"
                  }`}
                >
                  {isLocked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                  {isLocked ? "Locked" : "Unlocked"}
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  onNodeDragStop={onNodeDragStop}
                  fitView
                  minZoom={0.5}
                  maxZoom={1.5}
                  nodesDraggable={!isLocked}
                  panOnDrag={!isLocked}
                  zoomOnScroll={!isLocked}
                  preventScrolling={isLocked}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    color="rgba(26, 29, 41, 0.20)"
                    gap={16}
                    size={1.5}
                  />

                  <Panel
                    position="bottom-left"
                    className="cf-panel cf-raised flex flex-col gap-0.5 p-1"
                  >
                    <button
                      onClick={() => zoomIn()}
                      title="Zoom in"
                      aria-label="Zoom in"
                      className="size-7 rounded-md text-(--cf-ink) hover:bg-(--cf-cream) hover:text-(--cf-orange) flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      title="Zoom out"
                      aria-label="Zoom out"
                      className="size-7 rounded-md text-(--cf-ink) hover:bg-(--cf-cream) hover:text-(--cf-orange) flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => fitView({ duration: 400 })}
                      title="Fit view"
                      aria-label="Fit view"
                      className="size-7 rounded-md text-(--cf-ink) hover:bg-(--cf-cream) hover:text-(--cf-orange) flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                  </Panel>
                </ReactFlow>
              </div>
            </main>
          )}

          <FieldInspector
            selectedField={selectedField}
            label={label}
            setLabel={setLabel}
            placeholder={placeholder}
            setPlaceholder={setPlaceholder}
            description={description}
            setDescription={setDescription}
            isRequired={isRequired}
            handleRequiredChange={handleRequiredChange}
            optionsList={optionsList}
            setOptionsList={setOptionsList}
            updateLocal={updateLocal}
            handleDeleteField={handleDeleteField}
            segmentOptions={branchTargetSegments}
            currentSegmentId={selectedField?.segmentId ?? null}
            onChangeSegment={(segmentId) => {
              if (!selectedField) return;
              updateLocal(selectedField.id, { segmentId });
              // Follow the question to its new segment. The canvas is filtered
              // by segment, so leaving the filter where it was would make the
              // question the author just moved disappear while its inspector
              // stayed open beside the empty canvas.
              if (segmentId && selectedSegmentId !== null) setSelectedSegmentId(segmentId);
            }}
            ruleSummaries={selectedFieldRuleSummaries}
            incompleteRuleCount={selectedFieldIncompleteRules}
            onEditBranching={
              selectedField ? () => setBranchingFieldId(selectedField.id) : undefined
            }
            isLastInSegment={isSelectedFieldLastInSegment}
          />

          <VerticalScale className="hidden shrink-0 xl:block" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-(--cf-cream) lg:hidden">
          {/* Segments, collapsed by default.
           *
           * The panel used to exist only inside the desktop-only column,
           * which meant segments and everything reached through them were
           * simply absent on a phone — a form split into pages couldn't be
           * edited on the device most likely to be filling it in. Reusing the
           * same component rather than writing a phone-specific one keeps the
           * two from drifting; collapsing it keeps a four-segment list from
           * eating the screen above the outline. */}
          <div className="shrink-0 border-b" style={{ borderBottomColor: "var(--cf-line-strong)" }}>
            <button
              type="button"
              onClick={() => setMobileSegmentsOpen((prev) => !prev)}
              aria-expanded={mobileSegmentsOpen}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left"
            >
              <span className="inline-flex items-center gap-2">
                <Layers className="size-3.5 text-(--cf-orange)" />
                <span className="cf-meta">Segments</span>
                <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
                  {visibleSegments.length || "none"}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                {selectedSegmentId && (
                  <span className="max-w-32 truncate font-mono text-[10px] tracking-wider text-(--cf-orange) uppercase">
                    {visibleSegments.find((s) => s.id === selectedSegmentId)?.title ?? "filtered"}
                  </span>
                )}
                {mobileSegmentsOpen ? (
                  <ChevronUp className="size-4 text-(--cf-ink-soft)" />
                ) : (
                  <ChevronDown className="size-4 text-(--cf-ink-soft)" />
                )}
              </span>
            </button>

            {mobileSegmentsOpen && (
              <SegmentPanel
                segments={visibleSegments}
                questionCounts={segmentQuestionCounts}
                unassignedCount={unassignedQuestionCount}
                selectedSegmentId={selectedSegmentId}
                onSelectSegment={setSelectedSegmentId}
                onAddSegment={handleAddSegment}
                onRenameSegment={(id, title) => updateSegmentLocal(id, { title })}
                onMoveSegment={handleMoveSegment}
                onDeleteSegment={handleDeleteSegment}
              />
            )}
          </div>

          <FieldOutline
            fields={visibleSortedFields}
            onTapField={handleMobileTapField}
            onMove={handleMobileMove}
            selectedId={selectedNodeId}
            onAdd={() => setMobileAddOpen(true)}
          />
        </div>
      </div>

      <div className="lg:hidden">
        <MobileAddFieldSheet
          open={mobileAddOpen}
          onClose={() => setMobileAddOpen(false)}
          onSelect={handleMobileAddField}
        />
        <MobileFieldEditorSheet
          open={mobileEditorOpen}
          onClose={handleCloseMobileEditor}
          selectedField={selectedField}
          label={label}
          setLabel={setLabel}
          placeholder={placeholder}
          setPlaceholder={setPlaceholder}
          description={description}
          setDescription={setDescription}
          isRequired={isRequired}
          handleRequiredChange={handleRequiredChange}
          optionsList={optionsList}
          setOptionsList={setOptionsList}
          updateLocal={updateLocal}
          handleDeleteField={handleDeleteField}
          /* The same flow controls the desktop inspector gets. Without these
             the sheet rendered a field editor with no way to move a question
             between segments and no way into its branching — the features
             existed but were unreachable on a phone. */
          segmentOptions={branchTargetSegments}
          currentSegmentId={selectedField?.segmentId ?? null}
          onChangeSegment={(segmentId) => {
            if (!selectedField) return;
            updateLocal(selectedField.id, { segmentId });
            if (segmentId && selectedSegmentId !== null) setSelectedSegmentId(segmentId);
          }}
          ruleSummaries={selectedFieldRuleSummaries}
          incompleteRuleCount={selectedFieldIncompleteRules}
          onEditBranching={
            selectedField
              ? () => {
                  // Close the sheet first: both are fixed overlays, and leaving
                  // the sheet mounted underneath traps scrolling on it while
                  // the dialog is the thing being scrolled.
                  handleCloseMobileEditor();
                  setBranchingFieldId(selectedField.id);
                }
              : undefined
          }
          isLastInSegment={isSelectedFieldLastInSegment}
        />
      </div>

      <DeleteFormDialog
        show={showDeleteConfirm}
        formTitle={form.title}
        deletePending={deletePending}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          try {
            isDirtyRef.current = false;
            await deleteFormAsync({ id: formId });
            toast.success("Form deleted");
            router.push("/dashboard/sketches");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete");
            setShowDeleteConfirm(false);
          }
        }}
      />

      <UnsavedDialog
        show={showUnsavedDialog}
        onCancel={() => setShowUnsavedDialog(false)}
        onDiscard={() => {
          isDirtyRef.current = false;
          setDirtyIds(new Set());
          setPendingDeletes(new Set());
          setShowUnsavedDialog(false);
          if (pendingNavRef.current) window.location.href = pendingNavRef.current;
        }}
        onSaveAndLeave={async () => {
          await handleSave();
          isDirtyRef.current = false;
          setDirtyIds(new Set());
          setPendingDeletes(new Set());
          setShowUnsavedDialog(false);
          if (pendingNavRef.current) window.location.href = pendingNavRef.current;
        }}
      />

      {showShareDialog && form && (
        <ShareCollaboratorsDialog
          show={showShareDialog}
          formId={formId}
          formTitle={form.title}
          ownerEmail={form.ownerEmail}
          role={form.role}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showSettingsDialog && form && (
        <FormSettingsDialog
          show={showSettingsDialog}
          form={form}
          // Both from the draft, so the layout advice counts a segment or a
          // branch the author added but hasn't saved yet. Reading the saved form
          // instead would tell them one page is still available right up to the
          // moment they saved the rule that takes it away.
          segmentCount={visibleSegments.length}
          ruleCount={activeRuleCount}
          onClose={() => setShowSettingsDialog(false)}
        />
      )}

      {branchingFieldId && (
        <LogicDialog
          open
          onClose={() => setBranchingFieldId(null)}
          triggerFieldId={branchingFieldId}
          triggerFieldLabel={flowLabels.fieldLabel(branchingFieldId)}
          flow={draftFlow}
          labels={flowLabels}
          rules={rulesForField(branchingFieldId)}
          onAddRule={handleAddRule}
          onUpdateRule={handleUpdateRule}
          onDuplicateRule={handleDuplicateRule}
          onMoveRule={handleMoveRule}
          onDeleteRule={handleDeleteRule}
          onAddCondition={handleAddCondition}
          onUpdateCondition={handleUpdateCondition}
          onDeleteCondition={handleDeleteCondition}
        />
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderCanvas />
    </ReactFlowProvider>
  );
}
