"use client";

import React, { createContext, useContext } from "react";

interface DashboardContextType {
  openCreateFormModal: () => void;
  isCreatingForm: boolean;
  setIsCreatingForm: (v: boolean) => void;
  openCreateMentiModal: () => void;
  isCreatingMenti: boolean;
  setIsCreatingMenti: (v: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DashboardContextType;
}) => {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
