// frontend/src/components/programs/ProgramsView.tsx

import React from "react";
import { User, UserRole } from "../../../types";
import { ProgramsSection } from "../admin/ProgramsSection";
import { Layers } from "lucide-react";

interface ProgramsViewProps {
  currentUser: User;
}

export const ProgramsView: React.FC<ProgramsViewProps> = ({ currentUser }) => {
  const isAdmin =
    currentUser.role === UserRole.ADMIN ||
    currentUser.role.toLowerCase() === "admin";

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-100 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                Региональные программы
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? "Управление программами и массовое назначение задач"
                  : "Просмотр активных государственных программ"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          <ProgramsSection isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
};
