import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Download, Share2, Trash2, Plus, MessageSquare } from "lucide-react";
import { invokeSolveMath } from "@/lib/solveMath";
import { useToast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: number;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

const STORAGE_KEY = "inkCalcChats";

const loadChats = (): ChatThread[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveChats = (chats: ChatThread[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
};

const ChatSession = () => {
  const [chats, setChats] = useState<ChatThread[]>(loadChats);
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat?.messages.length]);

  const createNew = () => {
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    setChats((prev) => [thread, ...prev]);
    setActiveId(thread.id);
    setInput("");
  };

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let chatId = activeId;
    if (!chatId) {
      const thread: ChatThread = {
        id: crypto.randomUUID(),
        title: input.trim().slice(0, 40),
        messages: [],
        createdAt: Date.now(),
      };
      setChats((prev) => [thread, ...prev]);
      chatId = thread.id;
      setActiveId(chatId);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const updated = { ...c, messages: [...c.messages, userMsg] };
        if (c.messages.length === 0) updated.title = input.trim().slice(0, 40);
        return updated;
      })
    );
    setInput("");
    setIsLoading(true);

    try {
      const data = await invokeSolveMath({ text: userMsg.content }, { maxRetries: 2 });

      if (data.rateLimited) {
        toast({
          variant: "destructive",
          title: "Please wait a moment",
          description: data.error || "Too many requests right now. Try again shortly.",
        });
        return;
      }

      const answer = [
        data.expression && data.expression !== userMsg.content ? `**${data.expression}**\n` : "",
        Array.isArray(data.steps) && data.steps.length > 0
          ? data.steps.map((s: string) => `• ${s}`).join("\n") + "\n"
          : "",
        data.result || "I couldn't find an answer.",
      ]
        .filter(Boolean)
        .join("\n");

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ai",
        content: answer,
        timestamp: Date.now(),
      };

      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, aiMsg] } : c))
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to get answer" });
    } finally {
      setIsLoading(false);
    }
  };

  const exportChat = (thread: ChatThread) => {
    const text = thread.messages
      .map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${thread.title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareChat = async (thread: ChatThread) => {
    const text = thread.messages
      .map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`)
      .join("\n\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: thread.title, text });
      } catch {
        // user cancelled
      }
    } else {
      // Fallback: copy + open WhatsApp
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "Chat copied to clipboard. Opening WhatsApp..." });
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" /> Chat Sessions
        </h2>
        <button
          onClick={createNew}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium gradient-primary text-primary-foreground"
        >
          <Plus size={14} /> New Chat
        </button>
      </div>

      {/* Chat list */}
      {chats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all max-w-[140px] truncate ${
                activeId === c.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Active chat */}
      {activeChat ? (
        <div className="rounded-2xl border-2 border-border glass overflow-hidden flex flex-col" style={{ height: 420 }}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
            <p className="text-sm font-semibold text-foreground truncate flex-1">{activeChat.title}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => exportChat(activeChat)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Download">
                <Download size={14} className="text-muted-foreground" />
              </button>
              <button onClick={() => shareChat(activeChat)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Share">
                <Share2 size={14} className="text-muted-foreground" />
              </button>
              <button onClick={() => deleteChat(activeChat.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors" title="Delete">
                <Trash2 size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {activeChat.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare size={32} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">Type a math question or anything you want solved</p>
              </div>
            )}
            <AnimatePresence>
              {activeChat.messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                      msg.role === "user"
                        ? "gradient-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary/60 border border-border/50 text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary/60 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 size={16} className="text-primary animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 px-3 py-2.5 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask anything..."
              className="flex-1 bg-secondary/40 border border-border rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl gradient-primary text-primary-foreground disabled:opacity-40 transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <MessageSquare size={40} className="text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No chats yet</p>
          <p className="text-muted-foreground/60 text-xs">Start a new chat to ask questions</p>
        </div>
      )}
    </div>
  );
};

export default ChatSession;
