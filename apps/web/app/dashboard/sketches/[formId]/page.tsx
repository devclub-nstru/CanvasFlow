"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Background, BackgroundVariant, Panel, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronDown, ChevronUp, Layers, Lock, Maximize2, Minus, Plus, Unlock } from "lucide-react";
import { toast } from "sonner";

import { VerticalScale } from "~/components/Scale";
import { nodeTypes } from "~/components/builder/FormFieldNode";
import { FieldSidebar } from "~/components/builder/FieldSidebar";
import { FieldInspector } from "~/components/builder/FieldInspector";
import { BuilderHeader } from "~/components/builder/BuilderHeader";
import { UnsavedDialog } from "~/components/builder/UnsavedDialog";
import { DeleteFormDialog } from "~/components/builder/DeleteFormDialog";
import { FieldOutline } from "~/components/builder/FieldOutline";
import { SegmentPanel } from "~/components/builder/SegmentPanel";
import { LogicDialog } from "~/components/builder/LogicDialog";
import { MobileAddFieldSheet } from "~/components/builder/mobile/MobileAddFieldSheet";
import { MobileFieldEditorSheet } from "~/components/builder/mobile/MobileFieldEditorSheet";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";
import { FormSettingsDialog } from "~/components/builder/FormSettingsDialog";
import { ResponsesView } from "~/components/builder/ResponsesView";
import { useBuilderState } from "~/components/builder/useBuilderState";

function BuilderCanvas() {
  const router = useRouter();
  const {
    formId,
    reactFlowWrapper,
    form,
    formLoading,
    refetchForm,
    fieldsLoading,
    publishPending,
    deletePending,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showShareDialog,
    setShowShareDialog,
    showSettingsDialog,
    setShowSettingsDialog,
    setDirtyIds,
    setPendingDeletes,
    selectedSegmentId,
    setSelectedSegmentId,
    mobileSegmentsOpen,
    setMobileSegmentsOpen,
    isSaving,
    justSaved,
    showUnsavedDialog,
    setShowUnsavedDialog,
    pendingNavRef,
    isDirtyRef,
    isDirty,
    handleSave,
    updateLocal,
    visibleSegments,
    updateSegmentLocal,
    handleAddSegment,
    handleMoveSegment,
    handleDeleteSegment,
    nodes,
    onNodesChange,
    edges,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId,
    isLocked,
    setIsLocked,
    branchingFieldId,
    setBranchingFieldId,
    rulesForField,
    handleAddRule,
    handleUpdateRule,
    handleDeleteRule,
    handleDuplicateRule,
    handleMoveRule,
    handleAddCondition,
    handleUpdateCondition,
    handleDeleteCondition,
    view,
    handleViewChange,
    label,
    setLabel,
    placeholder,
    setPlaceholder,
    isRequired,
    description,
    setDescription,
    optionsList,
    setOptionsList,
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
  } = useBuilderState();

  const searchParams = useSearchParams();
  const isArchived = !!form?.isArchived;
  const activeTabParam = searchParams?.get("tab") || (isArchived ? "responses" : "questions");
  const activeTab =
    isArchived || activeTabParam === "responses" || activeTabParam === "summary"
      ? "responses"
      : "questions";

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
            You only have viewer access to &ldquo;{form.title}&rdquo;. You can view its submissions,
            but you cannot make changes to the fields.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href={`/dashboard/sketches/${formId}?tab=responses`}
              className="cf-btn cf-raised cf-press h-10 px-5 text-[13px]"
            >
              View responses
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
      {activeTab === "questions" && (
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
      )}

      {activeTab === "questions" ? (
        <>
          <div className="flex-1 flex overflow-hidden">
            <div className="hidden lg:flex flex-1 overflow-hidden">
              <VerticalScale className="hidden shrink-0 xl:block" />
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
              <div
                className="shrink-0 border-b"
                style={{ borderBottomColor: "var(--cf-line-strong)" }}
              >
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
                        {visibleSegments.find((s) => s.id === selectedSegmentId)?.title ??
                          "filtered"}
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
                      handleCloseMobileEditor();
                      setBranchingFieldId(selectedField.id);
                    }
                  : undefined
              }
              isLastInSegment={isSelectedFieldLastInSegment}
            />
          </div>
        </>
      ) : activeTab === "responses" ? (
        <ResponsesView
          formId={formId}
          fields={visibleSortedFields}
          segments={visibleSegments}
          submissionsCount={form?.submissionsCount ?? 0}
          formTitle={form.title}
          onNavigateTab={(tab) =>
            router.replace(`/dashboard/sketches/${formId}?tab=${tab}`, { scroll: false })
          }
          onShare={() => setShowShareDialog(true)}
          isArchived={isArchived}
          role={form.role}
        />
      ) : null}

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
