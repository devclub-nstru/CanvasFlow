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
import { Lock, Maximize2, Minus, Plus, Unlock } from "lucide-react";
import { toast } from "sonner";

import {
  useGetForm,
  useListFormFields,
  useCreateFormField,
  useUpdateFormField,
  useDeleteFormField,
  usePublishForm,
  useDeleteForm,
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
import { MobileAddFieldSheet } from "~/components/builder/mobile/MobileAddFieldSheet";
import { MobileFieldEditorSheet } from "~/components/builder/mobile/MobileFieldEditorSheet";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";
import { FormSettingsDialog } from "~/components/builder/FormSettingsDialog";

/* Preference is stored per user, not per form: someone who prefers the list
   surface wants it for whatever they open next, not just this one form. */
const VIEW_STORAGE_KEY = "canvasflow:builder-view";

function BuilderCanvas() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { form, isLoading: formLoading, refetch: refetchForm } = useGetForm(formId);
  const { fields, isLoading: fieldsLoading, refetch: refetchFields } = useListFormFields(formId);

  const { setIsCreatingForm } = useDashboard();
  useEffect(() => {
    if (!formLoading && !fieldsLoading) {
      setIsCreatingForm(false);
    }
  }, [formLoading, fieldsLoading, setIsCreatingForm]);

  const { createFormFieldAsync } = useCreateFormField();
  const { updateFormFieldAsync } = useUpdateFormField();
  const { deleteFormFieldAsync } = useDeleteFormField();
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
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

  const isDirty = dirtyIds.size > 0 || pendingDeletes.size > 0;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (fields && localFields.length === 0) {
      setLocalFields(fields as LocalField[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

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
      // capture server-assigned ids for newly-created fields so we can swap
      // local temp ids (`new-…`) → real UUIDs after the round-trip
      const tempIdToRealId = new Map<string, string>();
      // capture the new optimistic-lock version per updated field so the
      // local state stays in sync with what the server now considers
      // authoritative (next update reads from here)
      const updatedVersionById = new Map<string, number>();

      const createOps = localFields
        .filter((f) => f._isNew && !pendingDeletes.has(f.id))
        .map((f) => {
          const tempId = f.id;
          return createFormFieldAsync({
            formId,
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
            label: f.label,
            placeholder: f.placeholder ?? undefined,
            description: f.description ?? undefined,
            isRequired: f.isRequired,
            options: f.options ?? undefined,
            index: f.index ? String(f.index) : undefined,
            // Optimistic-lock token. The server compare-and-sets against
            // this; if another writer (e.g. the same form open in a
            // second tab) raced us, the server throws and we surface the
            // conflict below instead of silently overwriting their work.
            expectedVersion: typeof (f as any).version === "number" ? (f as any).version : 0,
          }).then((data) => {
            updatedVersionById.set(f.id, data.version);
          }),
        );

      const deleteOps = localFields
        .filter((f) => !f._isNew && pendingDeletes.has(f.id))
        .map((f) => deleteFormFieldAsync({ id: f.id }));

      await Promise.all([...createOps, ...updateOps, ...deleteOps]);

      // Apply server ids + new versions to local state, drop pending
      // deletes, clear _isNew.
      setLocalFields((prev) =>
        prev
          .filter((f) => !pendingDeletes.has(f.id))
          .map((f) => {
            const realId = tempIdToRealId.get(f.id);
            const newVersion = updatedVersionById.get(realId ?? f.id);
            const next: any = { ...f, _isNew: false };
            if (realId) next.id = realId;
            if (newVersion !== undefined) next.version = newVersion;
            return next;
          }),
      );
      // Remap a selected temp id to its real id if it was just created
      setSelectedNodeId((prev) =>
        prev && tempIdToRealId.has(prev) ? (tempIdToRealId.get(prev) as string) : prev,
      );
      setDirtyIds(new Set());
      setPendingDeletes(new Set());

      // Brief "Saved" confirmation in the header button
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
      toast.success("Saved");
    } catch (err) {
      // Detect optimistic-lock conflicts and surface them clearly.
      // The server throws with these recognisable phrases (see form-field
      // service). On conflict we refetch authoritative state and discard
      // local in-flight edits — heavy-handed but predictable.
      const message = err instanceof Error ? err.message : String(err);
      const isLockConflict =
        message.includes("modified by someone else") ||
        message.includes("raced with another change");

      if (isLockConflict) {
        toast.error("This form was edited from another session — reloading your view");
        // Pull authoritative state from the server. Local dirty edits are
        // lost intentionally so we don't silently overwrite the other
        // session. (Better collaborative resolution would need a real
        // merge step — out of scope here.)
        const refreshed = await refetchFields();
        if (refreshed.data) {
          setLocalFields(refreshed.data as any);
          setDirtyIds(new Set());
          setPendingDeletes(new Set());
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
  ]);

  const updateLocal = useCallback((id: string, patch: Partial<LocalField>) => {
    setLocalFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  // Highest index across every local field, including ones pending deletion.
  // Anything strictly above this is free in the table right now, which is what
  // makes it safe both for appending and for the renumber fallback.
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

  // Patch several fields in one commit. Used by the renumber fallback, which
  // has to move every field at once — doing that with N `updateLocal` calls
  // would queue N separate state updates over the same array.
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

  /* ─── React Flow state ─────────────────────────────────────────────── */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  /* ─── Editing surface ──────────────────────────────────────────────────
   *
   * Canvas is the default. Below `lg` the choice doesn't exist — the canvas
   * needs pointer drag-and-drop and room for three panes — so the list is
   * forced there by CSS rather than by this state. That means `view` only
   * decides what a large screen shows, and both trees stay mounted so
   * switching (or resizing) never loses draft edits.
   */
  const [view, setView] = useState<BuilderView>("canvas");

  // Restore the preference after mount rather than in the initial state:
  // localStorage isn't available during SSR, and seeding from it would make
  // the server and client markup disagree.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "canvas" || saved === "outline") setView(saved);
      // The surface was briefly called "list" before it grew into a full
      // three-pane outline; honour the old value rather than resetting.
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

  // Sync localFields → React Flow nodes/edges.
  // We intentionally *merge* instead of replacing the whole nodes array.
  // Replacing would clobber React Flow's per-node internal state (the
  // in-progress drag position, selection, hover) on every keystroke in
  // the inspector — that was breaking drag-reorder because each
  // `updateLocal` for a label edit would rebuild every node mid-frame.
  useEffect(() => {
    const visible = localFields
      .filter((f) => !pendingDeletes.has(f.id))
      // Sort by fractional index so the edge order (and any index-based
      // fallback positions for unsaved fields) match the current logical
      // sequence after a drag-reorder. Same tiebreak as
      // `visibleSortedFields`, so the canvas and the mobile list can't
      // disagree about the order of two fields sharing an index.
      .sort((a, b) => {
        const d = parseIndex(a.index) - parseIndex(b.index);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
    setNodes((prevNodes) => {
      const prevById = new Map(prevNodes.map((n) => [n.id, n]));
      return visible.map((field, idx) => {
        const existing = prevById.get(field.id);
        if (existing) {
          // Existing node — preserve React Flow's live position, selection,
          // dimensions, etc. Only refresh the field reference so the node's
          // visual (label, options, required pill) reflects the latest edit.
          return { ...existing, data: { field } };
        }
        // Brand new node — use the field's saved position or fall back to
        // a stacked layout below existing nodes.
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
    setEdges(mappedEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFields, pendingDeletes]);

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
      // Append past the highest index across *all* local fields, including
      // ones pending deletion. Two reasons this isn't a count of survivors:
      // a count lands mid-list when indices aren't contiguous (1, 5, 9 -> 4),
      // and a row pending deletion still occupies its index in the table
      // until the save runs, where creates and deletes go out concurrently.
      const nextIndex = formatIndex(maxLocalIndex() + 1);
      const newField = {
        id: tempId,
        formId,
        label: "",
        labelKey: "field",
        placeholder: null,
        isRequired: false,
        index: nextIndex,
        type: type as any,
        options: { position },
        description: null,
        // Optimistic-lock version. Brand-new local rows haven't been
        // sent to the server yet, so 0 is the baseline — the first
        // successful create will replace this with the server's value.
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _isNew: true,
      };
      setLocalFields((prev) => [...prev, newField]);
      setDirtyIds((prev) => new Set(prev).add(tempId));
      setSelectedNodeId(tempId);
    },
    // `maxLocalIndex` reads a ref, so this no longer depends on `localFields`
    // and the handler stops being rebuilt on every inspector keystroke.
    [screenToFlowPosition, formId, maxLocalIndex],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  /**
   * Commit a drag: persist where the node landed, and re-index it if the drop
   * changed its place in the vertical order.
   *
   * The canvas is read top to bottom, so y position *is* the order. Only the
   * dragged field's index is written — that is the point of fractional
   * indexing, and it's what keeps the save free of unique-constraint races,
   * since every field is saved as an independent concurrent UPDATE.
   */
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

      // Live position per field, with the dragged node's final position
      // substituted in — React Flow hasn't committed it to `nodes` yet at
      // dragStop. Fields with no node yet (just added) fall back to their
      // saved position.
      const livePos = new Map(nodes.map((n) => [n.id, n.position]));
      livePos.set(node.id, node.position);
      const posOf = (f: LocalField) =>
        livePos.get(f.id) ??
        ((f.options as any)?.position as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };

      const ordered = [...visible].sort((a, b) => {
        const pa = posOf(a);
        const pb = posOf(b);
        if (pa.y !== pb.y) return pa.y - pb.y;
        // Nodes sitting on the same row used to sort arbitrarily, which made
        // the order flip between drags. Break ties on x, then on the existing
        // index, so the result is always deterministic.
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

      // Already in the right place — a nudge that didn't cross a neighbour.
      // The old code compared `localFields` array order against y-sorted
      // order, which are different orderings, so this looked like a reorder
      // on every drag and burned a subdivision of the gap each time.
      if (isBetween(current, before, after)) {
        updateLocal(node.id, positionPatch);
        return;
      }

      const next = indexBetween(before, after);
      if (next !== null) {
        updateLocal(node.id, { ...positionPatch, index: next });
        return;
      }

      // No representable value left between the neighbours. Reaching this
      // takes ~50 consecutive drops into the same gap, but handle it rather
      // than silently dropping the reorder: lift the whole visible order to
      // max+1..max+n. Every new value is above every value currently in the
      // table, so these writes still can't collide with an un-written row,
      // even though they go out concurrently.
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

  /* ─── Mobile editor state & helpers ─────────────────────────────────
   * The mobile UI shares all underlying state (localFields, dirtyIds,
   * pendingDeletes, selectedNodeId) with the desktop canvas. These two
   * flags just control which bottom sheet is visible on phones/tablets.
   */
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  // Visible fields sorted by current index — what the mobile list renders.
  const visibleSortedFields = useMemo(
    () =>
      localFields
        // `filter` already returns a fresh array, so sorting it in place is
        // safe and doesn't touch `localFields`.
        .filter((f) => !pendingDeletes.has(f.id))
        .sort((a, b) => {
          const d = parseIndex(a.index) - parseIndex(b.index);
          // Duplicate indices shouldn't exist, but forms saved by the old
          // rounding scheme can carry them. Fall back to id so the order is at
          // least stable instead of flipping between renders.
          return d !== 0 ? d : a.id.localeCompare(b.id);
        }),
    [localFields, pendingDeletes],
  );

  // Tap a field card → select + open editor sheet.
  const handleMobileTapField = useCallback((id: string) => {
    setSelectedNodeId(id);
    setMobileEditorOpen(true);
  }, []);

  // Close the editor sheet and clear selection so the desktop highlight
  // doesn't carry over if the user resizes.
  const handleCloseMobileEditor = useCallback(() => {
    setMobileEditorOpen(false);
    setSelectedNodeId(null);
  }, []);

  /**
   * Arrow-button reorder. Avoids touch drag-and-drop, which fights vertical
   * scrolling on phones.
   *
   * This used to swap the two fields' index values, which wrote two rows and
   * left a window where both held the same index — with the save firing every
   * field concurrently, that tripped UNIQUE(form_id, index) depending on which
   * UPDATE landed first. Moving one field into the gap beside its neighbour
   * writes a single row instead.
   */
  const handleMobileMove = useCallback(
    (id: string, direction: "up" | "down") => {
      const list = visibleSortedFields;
      const i = list.findIndex((f) => f.id === id);
      if (i === -1) return;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;

      // Landing slot: moving up puts the field above list[j], moving down puts
      // it below list[j].
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

      // Gap exhausted — same fallback as the canvas drag: lift the reordered
      // sequence above every existing index so the writes stay collision-free.
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

  /**
   * Append a field to the end of the sequence and select it.
   *
   * Shared by every add affordance that isn't a canvas drop: the outline's
   * palette, the outline's CTA, and the phone's add sheet. A canvas position is
   * assigned too, below the last node, so the same form still lays out
   * sensibly if the user switches to the canvas surface afterwards.
   */
  const appendField = useCallback(
    (type: string) => {
      const last = visibleSortedFields[visibleSortedFields.length - 1];
      // Past every local index, not just the last visible one — a field
      // pending deletion keeps its index in the table until the save lands.
      const nextIndex = formatIndex(maxLocalIndex() + 1);

      const lastPos = (last?.options as any)?.position as { x: number; y: number } | undefined;
      const position = lastPos
        ? { x: lastPos.x, y: lastPos.y + 200 }
        : { x: 300, y: visibleSortedFields.length * 200 + 80 };

      const tempId = `new-${Date.now()}`;
      const newField: LocalField = {
        id: tempId,
        formId,
        label: "",
        labelKey: "field",
        placeholder: null,
        index: nextIndex,
        isRequired: false,
        type: type as any,
        options: { position } as any,
        description: null,
        // Optimistic-lock baseline for a not-yet-persisted field —
        // the server will assign the real version on first create.
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _isNew: true,
      };
      setLocalFields((prev) => [...prev, newField]);
      setDirtyIds((prev) => new Set(prev).add(tempId));
      setSelectedNodeId(tempId);
    },
    [visibleSortedFields, formId, maxLocalIndex],
  );

  // Phone add flow: pick a type in the sheet, then land straight in the
  // editor sheet, since there's no details pane to select into.
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
      <div className="h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)]">
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
      <div className="h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)]">
        <div className="text-center space-y-4 max-w-sm">
          <p className="cf-meta">Not found</p>
          <h3 className="cf-display text-[26px] leading-tight uppercase">Form not found</h3>
          <Link
            href="/dashboard/sketches"
            className="cf-btn cf-raised cf-press h-[40px] px-5 text-[13px]"
          >
            Back to forms
          </Link>
        </div>
      </div>
    );
  }

  if (form.role === "viewer") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)] p-4 text-center">
        <div className="cf-panel cf-raised w-full max-w-sm space-y-4 p-7">
          <p className="cf-meta" style={{ color: "var(--cf-orange)" }}>
            No edit access
          </p>
          <h3 className="cf-display text-[22px] leading-snug text-[color:var(--cf-ink)]">
            You don&apos;t have access to edit this form
          </h3>
          <p className="text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
            You only have viewer access to &ldquo;{form.title}&rdquo;. You can view its submissions
            and analytics, but you cannot make changes to the fields.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href={`/dashboard/analytics?form=${formId}`}
              className="cf-btn cf-raised cf-press h-[40px] px-5 text-[13px]"
            >
              View analytics
            </Link>
            <Link href="/dashboard/sketches" className="cf-btn-outline h-[40px] px-5 text-[13px]">
              Back to studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)]">
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
        {/* Desktop shell. Both surfaces share it — palette on the left,
            details on the right, and the middle swapping between the freeform
            canvas and the ordered outline. Hidden below lg, where there's no
            room for three panes and the phone tree takes over. */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          {/* Ruled page margins, matching the dashboard, landing and auth
              surfaces. Real layout columns here rather than the absolute
              overlays the dashboard uses, because the builder is full-bleed:
              an overlay would sit on top of the field list. Held back to xl
              because the two side panes already claim ~550px, and below that
              the 80px the rails cost comes straight out of the middle. */}
          <VerticalScale className="hidden shrink-0 xl:block" />

          {/* On the outline surface a drag has nowhere to land, so the palette
              appends on click instead. */}
          <FieldSidebar
            onDragStart={onDragStart}
            onPick={view === "outline" ? appendField : undefined}
          />

          {view === "outline" ? (
            <main
              className="relative flex h-full flex-1 flex-col border-r bg-[color:var(--cf-cream)]"
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
              className="relative flex h-full flex-1 flex-col border-r bg-[color:var(--cf-cream)]"
              style={{ borderRightColor: "var(--cf-line-strong)" }}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              {/* Canvas chrome. Gives the middle pane a top edge so the three
                panes read as drawn panels, and carries the lock, which was
                previously buried in the floating zoom stack. */}
              <div className="cf-pane-bar">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="cf-meta">Canvas</span>
                  <span className="font-mono text-[10px] tracking-wider text-[color:var(--cf-ink-soft)]">
                    {visibleSortedFields.length}{" "}
                    {visibleSortedFields.length === 1 ? "field" : "fields"}
                  </span>
                </div>

                <button
                  onClick={() => setIsLocked(!isLocked)}
                  aria-pressed={isLocked}
                  title={isLocked ? "Unlock canvas" : "Lock canvas"}
                  className={`inline-flex h-[22px] shrink-0 cursor-pointer items-center gap-1.5 border px-2 font-mono text-[10px] tracking-wider uppercase transition-colors ${
                    isLocked
                      ? "border-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
                      : "border-[color:var(--cf-line-strong)] text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)]"
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
                      className="size-7 rounded-md text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] hover:text-[color:var(--cf-orange)] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      title="Zoom out"
                      aria-label="Zoom out"
                      className="size-7 rounded-md text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] hover:text-[color:var(--cf-orange)] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => fitView({ duration: 400 })}
                      title="Fit view"
                      aria-label="Fit view"
                      className="size-7 rounded-md text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] hover:text-[color:var(--cf-orange)] flex items-center justify-center transition-colors cursor-pointer"
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
          />

          <VerticalScale className="hidden shrink-0 xl:block" />
        </div>

        {/* Phone / tablet. Same state as the desktop shell, but there's no room
            for a details pane, so a card opens a bottom sheet instead and the
            outline carries its own add button. */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[color:var(--cf-cream)] lg:hidden">
          <FieldOutline
            fields={visibleSortedFields}
            onTapField={handleMobileTapField}
            onMove={handleMobileMove}
            selectedId={selectedNodeId}
            onAdd={() => setMobileAddOpen(true)}
          />
        </div>
      </div>

      {/* Bottom sheets are the phone's stand-in for the details pane, so they
          stay tied to the phone breakpoint rather than to the chosen surface —
          on a large screen the inspector does this job. */}
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
          onClose={() => setShowSettingsDialog(false)}
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
