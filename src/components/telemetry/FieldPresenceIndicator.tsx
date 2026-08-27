import React from "react";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useAuth } from "../../contexts/AuthContext";
import { Users } from "lucide-react";

interface FieldPresenceIndicatorProps {
  fieldName: string;
}

export function FieldPresenceIndicator({ fieldName }: FieldPresenceIndicatorProps) {
  const { viewers } = useRealtime();
  const { user } = useAuth();

  // Find other collaborators actively focused on this field
  const editingOthers = viewers.filter(
    (v) => v.activeField === fieldName && v.id !== user?.id
  );

  if (editingOthers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-primary-glow animate-pulse">
      <Users className="w-3 h-3" />
      <span>
        {editingOthers.map((v) => v.name).join(", ")} {editingOthers.length === 1 ? "is" : "are"} editing this field...
      </span>
    </div>
  );
}
