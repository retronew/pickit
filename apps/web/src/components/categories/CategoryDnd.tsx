import { createContext, useContext, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { FolderIcon, HomeIcon } from "lucide-react";
import type { CategoryNode } from "#lib/categories";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

/** Drop target id of the "top level" zone; category paths never start with a space. */
const TOP = " top";

interface Props {
  nodes: CategoryNode[];
  canMoveUnder: (node: CategoryNode, parent: string) => boolean;
  onMove: (node: CategoryNode, parent: string) => void;
  children: ReactNode;
}

const DraggingContext = createContext<{ dragging: CategoryNode | null; canMoveUnder: Props["canMoveUnder"] }>({
  dragging: null,
  canMoveUnder: () => false,
});

/** Drag a category onto another to move it inside, or onto the top zone to make it top level. */
export function CategoryDnd({ nodes, canMoveUnder, onMove, children }: Props) {
  const [dragging, setDragging] = useState<CategoryNode | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart({ active }: DragStartEvent) {
    setDragging(nodes.find((n) => n.category === active.id) ?? null);
  }

  function onDragEnd({ over }: DragEndEvent) {
    const node = dragging;
    setDragging(null);
    if (!node || !over) return;
    const parent = over.id === TOP ? "" : String(over.id);
    if (canMoveUnder(node, parent)) onMove(node, parent);
  }

  return (
    <DraggingContext.Provider value={{ dragging, canMoveUnder }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        {/* Only when the top level is a real target: not for a category that is already there. */}
        {dragging && canMoveUnder(dragging, "") && <TopZone />}
        {children}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex w-fit items-center gap-2 rounded-lg border bg-background px-3 py-1.5 font-medium text-sm shadow-lg">
              <FolderIcon className="size-4 text-muted-foreground" />
              {dragging.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DraggingContext.Provider>
  );
}

function TopZone() {
  const { setNodeRef, isOver } = useDroppable({ id: TOP });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Floats over the page instead of pushing the rows down: dnd-kit measures
        // the rows when a drag starts, so a layout shift would misplace every target.
        "fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center justify-center gap-2 rounded-lg border border-dashed bg-background/95 py-3 text-muted-foreground text-sm shadow-lg backdrop-blur transition-colors",
        isOver && "border-primary bg-accent text-foreground",
      )}
    >
      <HomeIcon className="size-4" />
      {m.category_drop_top()}
    </div>
  );
}

/**
 * Drag handle and drop target for one row. `handle` goes on the grip button;
 * `dropRef` on the row, which highlights while a valid category hovers it.
 */
export function useCategoryDrag(node: CategoryNode) {
  const { dragging, canMoveUnder } = useContext(DraggingContext);
  const drag = useDraggable({ id: node.category });
  const allowed = !!dragging && canMoveUnder(dragging, node.category);
  // Always enabled (see TopZone); an invalid target just doesn't highlight or accept.
  const drop = useDroppable({ id: node.category });
  return {
    handle: { ref: drag.setActivatorNodeRef, ...drag.attributes, ...drag.listeners },
    dropRef: (el: HTMLElement | null) => {
      drag.setNodeRef(el);
      drop.setNodeRef(el);
    },
    isDragging: drag.isDragging,
    isOver: drop.isOver && allowed,
    /** Another category is being dragged and can't go here. */
    blocked: !!dragging && !allowed && !drag.isDragging,
  };
}
