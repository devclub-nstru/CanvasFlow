"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  nodeTypes,
  getFieldOptionsArray,
} from "~/components/builder/FormFieldNode";
import { FieldSidebar } from "~/components/builder/FieldSidebar";
import { FieldInspector } from "~/components/builder/FieldInspector";
import { BuilderHeader } from "~/components/builder/BuilderHeader";
import { UnsavedDialog } from "~/components/builder/UnsavedDialog";
import { DeleteFormDialog } from "~/components/builder/DeleteFormDialog";
import { MobileFieldList } from "~/components/builder/mobile/MobileFieldList";
import { MobileAddFieldSheet } from "~/components/builder/mobile/MobileAddFieldSheet";
import { MobileFieldEditorSheet } from "~/components/builder/mobile/MobileFieldEditorSheet";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";

function BuilderCanvas() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { form, isLoading: formLoading, refetch: refetchForm } = useGetForm(
    formId
  );
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
        .filter(
          (f) =>
            !f._isNew && dirtyIds.has(f.id) && !pendingDeletes.has(f.id)
        )
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
            expectedVersion:
              typeof (f as any).version === "number"
                ? (f as any).version
                : 0,
          }).then((data) => {
            updatedVersionById.set(f.id, data.version);
          })
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
          })
      );
      // Remap a selected temp id to its real id if it was just created
      setSelectedNodeId((prev) =>
        prev && tempIdToRealId.has(prev)
          ? (tempIdToRealId.get(prev) as string)
          : prev
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
        toast.error(
          "This form was edited from another session — reloading your view"
        );
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

  const updateLocal = useCallback(
    (id: string, patch: Partial<LocalField>) => {
      setLocalFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
      );
      setDirtyIds((prev) => new Set(prev).add(id));
    },
    []
  );

  /* ─── React Flow state ─────────────────────────────────────────────── */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

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
      // sequence after a drag-reorder.
      .sort(
        (a, b) =>
          parseFloat(String(a.index)) - parseFloat(String(b.index))
      );
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
        const p =
          (typeof field.options === "object" && field.options
            ? (field.options as any)
            : {}
          ).position || { x: 300, y: idx * 200 + 80 };
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
    [localFields, selectedNodeId]
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
      const nextIndex = (
        localFields.filter((f) => !pendingDeletes.has(f.id)).length + 1
      ).toFixed(2);
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
    [screenToFlowPosition, localFields, pendingDeletes, formId]
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
          ? currentField.options
          : {};
      const sortedNodes = [...nodes];
      const idx = sortedNodes.findIndex((n) => n.id === node.id);
      if (idx !== -1)
        sortedNodes[idx] = { ...sortedNodes[idx]!, position: node.position };
      sortedNodes.sort((a, b) => a.position.y - b.position.y);
      const originalOrder = localFields
        .filter((f) => !pendingDeletes.has(f.id))
        .map((f) => f.id);
      const newOrder = sortedNodes.map((n) => n.id);
      const orderChanged =
        JSON.stringify(originalOrder) !== JSON.stringify(newOrder);

      let newIndex: string = String(currentField.index);
      if (orderChanged) {
        const newIdx = sortedNodes.findIndex((n) => n.id === node.id);
        if (newIdx === 0) {
          const below = (sortedNodes[1]?.data as any)?.field;
          if (below) newIndex = (parseFloat(below.index) / 2).toFixed(2);
        } else if (newIdx === sortedNodes.length - 1) {
          const above = (sortedNodes[newIdx - 1]?.data as any)?.field;
          if (above) newIndex = (parseFloat(above.index) + 1.0).toFixed(2);
        } else {
          const above = (sortedNodes[newIdx - 1]?.data as any)?.field;
          const below = (sortedNodes[newIdx + 1]?.data as any)?.field;
          if (above && below)
            newIndex = (
              (parseFloat(above.index) + parseFloat(below.index)) /
              2
            ).toFixed(2);
        }
      }
      updateLocal(node.id, {
        index: newIndex,
        options: { ...(currentOpts as any), position: node.position },
      });
    },
    [localFields, pendingDeletes, nodes, updateLocal]
  );

  const handleRequiredChange = useCallback(
    (checked: boolean) => {
      if (!selectedField) return;
      setIsRequired(checked);
      updateLocal(selectedField.id, { isRequired: checked });
    },
    [selectedField, updateLocal]
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
        .filter((f) => !pendingDeletes.has(f.id))
        .sort(
          (a, b) =>
            parseFloat(String(a.index)) - parseFloat(String(b.index))
        ),
    [localFields, pendingDeletes]
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

  // Arrow-button reorder: swap index values with the adjacent visible
  // field. Predictable and avoids touch-DnD pain on phones.
  const handleMobileMove = useCallback(
    (id: string, direction: "up" | "down") => {
      const i = visibleSortedFields.findIndex((f) => f.id === id);
      if (i === -1) return;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= visibleSortedFields.length) return;
      const a = visibleSortedFields[i]!;
      const b = visibleSortedFields[j]!;
      updateLocal(a.id, { index: String(b.index) });
      updateLocal(b.id, { index: String(a.index) });
    },
    [visibleSortedFields, updateLocal]
  );

  // Add a new field via the mobile sheet. Places the new node below the
  // last one so the desktop canvas still renders sensibly if the user
  // opens this form on a larger screen later.
  const handleMobileAddField = useCallback(
    (type: string) => {
      const last = visibleSortedFields[visibleSortedFields.length - 1];
      const lastIndexNum = last ? parseFloat(String(last.index)) : 0;
      const nextIndex = (lastIndexNum + 1).toFixed(2);

      const lastPos = (last?.options as any)?.position as
        | { x: number; y: number }
        | undefined;
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
      setMobileAddOpen(false);
      setMobileEditorOpen(true);
    },
    [visibleSortedFields, formId]
  );

  if (formLoading || fieldsLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
          <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
            Loading canvas...
          </span>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[color:var(--cf-cream)]">
        <div className="text-center space-y-4 max-w-sm">
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
            Not found
          </p>
          <h3 className="cf-display text-[24px] leading-tight">
            We couldn&apos;t find this form
          </h3>
          <Link
            href="/dashboard/sketches"
            className="inline-flex items-center gap-1.5 px-5 h-[40px] rounded-full bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[13px] font-medium transition-colors"
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
        <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-7 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)] space-y-4">
          <p className="cf-eyebrow text-[color:var(--cf-orange)]">
            No edit access
          </p>
          <h3 className="cf-display text-[22px] leading-snug text-[color:var(--cf-ink)]">
            You don&apos;t have access to edit this form
          </h3>
          <p className="text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
            You only have viewer access to &ldquo;{form.title}&rdquo;. You can view its submissions and analytics, but you cannot make changes to the fields.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href={`/dashboard/analytics?form=${formId}`}
              className="inline-flex items-center justify-center gap-1.5 px-5 h-[40px] rounded-full bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[13px] font-medium transition-colors"
            >
              View Analytics & Submissions
            </Link>
            <Link
              href="/dashboard/sketches"
              className="inline-flex items-center justify-center gap-1.5 px-5 h-[40px] rounded-full text-[13px] font-medium text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors ring-1 ring-[color:var(--cf-line-strong)]"
            >
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
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop canvas — drag-and-drop builder. Hidden below lg where
            touch DnD doesn't work well; the mobile list takes over there. */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <FieldSidebar onDragStart={onDragStart} />

          <main
            ref={reactFlowWrapper}
            className="flex-1 h-full relative bg-[color:var(--cf-cream)]"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
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
                color="rgba(22, 19, 17, 0.18)"
                gap={16}
                size={1.5}
              />

              <Panel
                position="bottom-left"
                className="bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line)] rounded-xl p-1 flex flex-col gap-0.5 shadow-[0_4px_12px_-6px_rgba(22,19,17,0.15)]"
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
                <div className="h-px bg-[color:var(--cf-line)] mx-1 my-0.5" />
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  title={isLocked ? "Unlock canvas" : "Lock canvas"}
                  aria-label={isLocked ? "Unlock canvas" : "Lock canvas"}
                  className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                    isLocked
                      ? "text-[color:var(--cf-orange)] bg-[color:var(--cf-orange)]/10"
                      : "text-[color:var(--cf-ink-soft)] hover:bg-[color:var(--cf-cream)] hover:text-[color:var(--cf-ink)]"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Unlock className="size-3.5" />
                  )}
                </button>
              </Panel>
            </ReactFlow>
          </main>

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
        </div>

        {/* Mobile / tablet stacked list editor. Same state as desktop,
            different surface — tap to edit, arrows to reorder. */}
        <div className="lg:hidden flex-1 flex flex-col overflow-hidden bg-[color:var(--cf-cream)]">
          <MobileFieldList
            fields={visibleSortedFields}
            onTapField={handleMobileTapField}
            onMove={handleMobileMove}
            onAdd={() => setMobileAddOpen(true)}
          />
        </div>
      </div>

      {/* Mobile sheets — wrapped in lg:hidden so they never appear on
          desktop even if their open state happens to be true. */}
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
            toast.error(
              err instanceof Error ? err.message : "Failed to delete"
            );
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
          if (pendingNavRef.current)
            window.location.href = pendingNavRef.current;
        }}
        onSaveAndLeave={async () => {
          await handleSave();
          isDirtyRef.current = false;
          setDirtyIds(new Set());
          setPendingDeletes(new Set());
          setShowUnsavedDialog(false);
          if (pendingNavRef.current)
            window.location.href = pendingNavRef.current;
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
