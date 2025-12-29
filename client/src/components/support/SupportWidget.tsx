import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, ChevronLeft, ExternalLink, Mail, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SUPPORT_DATA, SupportOption } from "@/config/support-data";

const SUPPORT_BUTTON_CLASS = "justify-start text-left h-auto py-2.5 px-4 whitespace-normal hover:bg-slate-50 w-full transition-colors flex items-center gap-2 font-medium";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
  actionLabel?: string;
  actionLink?: string;
}

export function SupportWidget() {
  const [location] = useLocation();
  const isEditor = location === "/editor";

  const { isSupportOpen, setSupportOpen } = useCanvasStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentLevel, setCurrentLevel] = useState<SupportOption[]>(SUPPORT_DATA);
  const [navHistory, setNavHistory] = useState<SupportOption[][]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSupportOpen]);

  const contactOption = SUPPORT_DATA.find(o => o.id === 'contact');

  const handleOptionClick = (option: SupportOption) => {
    if (option.subOptions && option.subOptions.length > 0) {
      setNavHistory([...navHistory, currentLevel]);
      setCurrentLevel(option.subOptions);
      return;
    }

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: option.label }
    ];

    if (option.response) {
      newMessages.push({ 
        role: "bot", 
        content: option.response,
        actionLabel: option.actionLabel,
        actionLink: option.actionLink
      });
    }

    setMessages(newMessages);
  };

  const handleBack = () => {
    if (navHistory.length > 0) {
      const prevLevel = navHistory[navHistory.length - 1];
      setNavHistory(navHistory.slice(0, -1));
      setCurrentLevel(prevLevel);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setCurrentLevel(SUPPORT_DATA);
    setNavHistory([]);
  };

  return (
    <div className={`fixed bottom-6 z-50 flex flex-col gap-4 ${
      isEditor ? "left-6 items-start" : "right-6 items-end"
    }`}>
      <AnimatePresence>
        {isSupportOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* UPDATED: Increased height to 750px and added max-viewport constraint */}
            <Card className="w-[400px] h-[750px] max-h-[85vh] shadow-xl border-primary/20 flex flex-col overflow-hidden bg-background">
              {/* Header */}
              <div className="p-4 bg-white border-b flex justify-between items-center">
                <img 
                  src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1765033347/doculoom-io-wordmark-logo-cropped_iwkw3v.png" 
                  alt="Doculoom" 
                  className="h-6" 
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:bg-muted" 
                  onClick={() => setSupportOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Chat Content */}
              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="space-y-4">
                  <div className="flex gap-2 justify-start">
                    <div className="bg-white border p-3 rounded-lg rounded-tl-none text-sm max-w-[85%] shadow-sm">
                      Hi there! 👋 How can we help you today?
                    </div>
                  </div>

                  {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-lg text-sm shadow-sm max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-white border rounded-tl-none w-full'
                      }`}>
                        {msg.content}

                        {msg.actionLabel && msg.actionLink && (
                          <a 
                            href={msg.actionLink} 
                            className="block mt-3"
                            target={msg.actionLink.startsWith("http") ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" className={SUPPORT_BUTTON_CLASS}>
                              {msg.actionLink.startsWith("mailto:") ? <Mail className="h-4 w-4 text-primary"/> : <ExternalLink className="h-4 w-4 text-primary" />}
                              {msg.actionLabel}
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Footer Interaction Zone */}
              <div className="p-4 border-t bg-white">
                <div className="grid gap-2">
                  {currentLevel.map((option) => (
                    <Button 
                      key={option.id} 
                      variant="outline"
                      className={SUPPORT_BUTTON_CLASS}
                      onClick={() => handleOptionClick(option)}
                    >
                      {option.label}
                    </Button>
                  ))}

                  {currentLevel.length === 0 && contactOption && (
                    <Button 
                      key={contactOption.id} 
                      variant="outline"
                      className={SUPPORT_BUTTON_CLASS}
                      onClick={() => handleOptionClick(contactOption)}
                    >
                      {contactOption.label}
                    </Button>
                  )}

                  <div className="flex gap-2 mt-2">
                    {navHistory.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={resetChat} className="ml-auto text-muted-foreground">
                      <RotateCcw className="h-3 w-3 mr-1" /> Start Over
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        className="h-16 w-16 rounded-full shadow-lg transition-transform hover:scale-105 [&_svg]:size-7"
        onClick={() => setSupportOpen(!isSupportOpen)}
      >
        {isSupportOpen ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}