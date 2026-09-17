import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { invokeSolveMath } from "@/lib/solveMath";

interface Msg {
  id: string;
  role: "user" | "ai";
  content: string;
}

const FloatingChat = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, open]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await invokeSolveMath({ text }, { maxRetries: 2 });

      if (data.rateLimited) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "ai",
            content: "Too many requests right now. Please wait a few seconds and try again.",
          },
        ]);
        return;
      }

      const answer = data.result || "I couldn't find an answer.";
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "ai", content: answer }]);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "ai", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 sm:left-auto sm:right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-2 border-border glass overflow-hidden flex flex-col shadow-2xl"
            style={{ height: 400 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/30">
              <span className="text-sm font-bold text-foreground">AI Assistant</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary"><X size={16} className="text-muted-foreground" /></button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <MessageCircle size={28} className="text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/50">Ask any math or academic question</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "gradient-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary/60 border border-border/50 text-foreground rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/60 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 size={14} className="text-primary animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 px-3 py-2 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={3}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Ask a longer question here..."
                className="min-h-[84px] flex-1 resize-none bg-secondary/40 border border-border rounded-xl px-3 py-2.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button onClick={send} disabled={!input.trim() || loading} className="p-2 rounded-xl gradient-primary text-primary-foreground disabled:opacity-40">
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 left-4 z-50 w-14 h-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </>
  );
};

export default FloatingChat;
