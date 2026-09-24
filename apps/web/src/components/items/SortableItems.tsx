import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "#lib/utils";

interface Props {
  /** Card ids per group, in display order; a card only moves within its group. */
  groups: number[][];
  /** Omitted = sorting is off and cards render as usual. */
  onReorder?: (ids: number[]) => void;
  children: ReactNode;
}

/** Drag-to-reorder for the item grid (manual sort). */
export function SortableItems({ groups, onReorder, children }: Props) {
  const sensors = useSensors(
    // A small move before dragging, so clicks on links and buttons still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long-press to drag, so the page still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (!onReorder) return children;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const group = groups.find((ids) => ids.includes(Number(active.id)));
    if (!group || !group.includes(Number(over.id))) return;
    onReorder!(arrayMove(group, group.indexOf(Number(active.id)), group.indexOf(Number(over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={groups.flat()} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** One draggable card; renders its child unchanged when sorting is off. */
export function SortableCard({ id, enabled, children }: { id: number; enabled: boolean; children: ReactNode }) {
  if (!enabled) return children;
  return <DraggableCard id={id}>{children}</DraggableCard>;
}

function DraggableCard({ id, children }: { id: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("cursor-grab touch-manipulation", isDragging && "relative z-10 cursor-grabbing opacity-80 shadow-lg")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
