import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Notebook, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export interface SavedNote {
  id: string;
  expression: string;
  result: string;
  steps: string[];
  timestamp: number;
}

interface NotebookSaverProps {
  notes: SavedNote[];
  onDelete: (id: string) => void;
  onClear: () => void;
}

const NotebookSaver = ({ notes, onDelete, onClear }: NotebookSaverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  if (notes.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-border glass overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2">
          <Notebook size={16} className="text-accent" />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            My Notes
          </span>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              Clear All
            </button>
          )}
          {isOpen ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
              {notes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-xl bg-secondary/30 border border-border/50 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                    onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {note.expression}
                      </p>
                      <p className="text-sm font-bold gradient-text truncate">= {note.result}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(note.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(note.id);
                        }}
                        className="p-1 rounded hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedNote === note.id && note.steps.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/30"
                      >
                        <div className="px-3 py-2 space-y-1">
                          {note.steps.map((step, i) => (
                            <p key={i} className="text-xs text-muted-foreground font-mono">
                              {step}
                            </p>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotebookSaver;
