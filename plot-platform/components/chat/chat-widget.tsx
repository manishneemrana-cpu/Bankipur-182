"use client";

import { useState } from "react";

import type { ChatMessage, ExecutedToolCall } from "@/lib/ai/chat-types";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

import { PlotResultCard, type ChatPlotCard } from "./plot-result-card";

const STARTER_CHIPS_EN = [
  "Available east-facing plots",
  "Plots under ₹30 lakh",
  "How far is the highway?",
  "Book a site visit",
];
const STARTER_CHIPS_HI = [
  "पूर्व दिशा के उपलब्ध प्लॉट",
  "₹30 लाख से कम के प्लॉट",
  "हाईवे कितनी दूर है?",
  "साइट विज़िट बुक करें",
];

interface DisplayMessage extends ChatMessage {
  plotCards?: ChatPlotCard[];
}

function extractPlotCards(toolCalls: ExecutedToolCall[]): ChatPlotCard[] {
  const cards: ChatPlotCard[] = [];
  for (const call of toolCalls) {
    if (call.name === "search_plots") {
      const output = call.output as { plots?: ChatPlotCard[] } | null;
      if (output?.plots) cards.push(...output.plots);
    }
    if (call.name === "get_plot") {
      const output = call.output as ChatPlotCard | { error?: string } | null;
      if (output && "plot_number" in output) cards.push(output);
    }
  }
  return cards;
}

/** Floating "Ask about this project" button + full-screen (mobile) chat
 * sheet (§12.3). `onHighlight`/`onOpenPlot` keep the map in sync with
 * highlight_plots/open_plot tool actions. */
export function ChatWidget({
  projectSlug,
  lang,
  onHighlight,
  onOpenPlot,
}: {
  projectSlug: string;
  lang: Lang;
  onHighlight: (plotNumbers: string[]) => void;
  onOpenPlot: (plotNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const nextMessages: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: trimmed },
    ];
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, messages: nextMessages }),
      });
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Sorry, something went wrong. Please try again or contact the sales team.",
          },
        ]);
        return;
      }
      const data = (await res.json()) as {
        text: string;
        toolCalls: ExecutedToolCall[];
      };

      const highlighted = data.toolCalls.find(
        (c) => c.name === "highlight_plots",
      );
      if (highlighted) {
        const highlightInput = highlighted.input as {
          plot_numbers?: string[];
        };
        if (highlightInput.plot_numbers) {
          onHighlight(highlightInput.plot_numbers);
        }
      }
      const opened = data.toolCalls.find((c) => c.name === "open_plot");
      if (opened) {
        const openedInput = opened.input as { plot_number?: string };
        if (openedInput.plot_number) onOpenPlot(openedInput.plot_number);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          plotCards: extractPlotCards(data.toolCalls),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong. Please try again or contact the sales team.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const chips = lang === "hi" ? STARTER_CHIPS_HI : STARTER_CHIPS_EN;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-30 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg sm:bottom-6"
      >
        {t(lang, "chat")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{t(lang, "chat")}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => send(chip)}
                    className="rounded-full border border-input px-3 py-1.5 text-xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "mr-auto max-w-[85%] rounded-md border border-input px-3 py-2 text-sm"
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.plotCards && m.plotCards.length > 0 ? (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {m.plotCards.map((p) => (
                          <PlotResultCard
                            key={p.plot_number}
                            plot={p}
                            onView={onOpenPlot}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {pending ? (
                  <div className="mr-auto rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                    …
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about plots, price, location…"
              className="h-10 flex-1 rounded-md border border-input px-3 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
