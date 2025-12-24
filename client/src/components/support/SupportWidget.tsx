import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, ChevronLeft, ExternalLink, Mail } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SUPPORT_DATA, SupportOption } from "@/config/support-data";

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<SupportOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, isOpen]);

  const currentOptions = history.length > 0 
    ? history[history.length - 1].subOptions 
    : SUPPORT_DATA;

  // Find the contact option from the root data to reuse it as a fallback
  const contactOption = SUPPORT_DATA.find(o => o.id === 'contact');

  const handleOptionClick = (option: SupportOption) => {
    setHistory([...history, option]);
  };

  const handleBack = () => {
    setHistory(history.slice(0, -1));
  };

  const resetChat = () => {
    setHistory([]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="w-[400px] h-[600px] shadow-xl border-primary/20 flex flex-col overflow-hidden bg-background">

              {/* Header */}
              <div className="p-4 bg-white border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img 
                    src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1765033347/doculoom-io-wordmark-logo-cropped_iwkw3v.png" 
                    alt="Doculoom" 
                    className="h-6" 
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:bg-muted" 
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Chat Content */}
              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="space-y-4">
                  {/* Intro Message */}
                  <div className="flex gap-2">
                    <div className="bg-white border p-3 rounded-lg rounded-tl-none text-sm max-w-[85%] shadow-sm">
                      Hi there! 👋 How can we help you today?
                    </div>
                  </div>

                  {/* History of interaction */}
                  {history.map((item, index) => (
                    <div key={item.id + index} className="space-y-4">
                      {/* User Selection */}
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none text-sm shadow-sm">
                          {item.label}
                        </div>
                      </div>

                      {/* Bot Response */}
                      {item.response && (
                        <div className="flex gap-2">
                           <div className="bg-white border p-3 rounded-lg rounded-tl-none text-sm max-w-[85%] shadow-sm">
                            {item.response}

                            {/* Action Link Button */}
                            {item.actionLabel && item.actionLink && (
                              <a 
                                href={item.actionLink} 
                                className="block mt-3"
                                target={item.actionLink.startsWith("http") ? "_blank" : "_self"}
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="outline" className="w-full gap-2">
                                  {item.actionLink.startsWith("mailto:") ? <Mail className="h-3 w-3"/> : <ExternalLink className="h-3 w-3" />}
                                  {item.actionLabel}
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Interactive Options Footer */}
              <div className="p-4 border-t bg-white">
                <div className="grid gap-2">
                  {/* Render standard options if available */}
                  {currentOptions?.map((option) => (
                    <Button 
                      key={option.id} 
                      variant="outline"
                      className="justify-start text-left h-auto py-2 whitespace-normal hover:bg-slate-50"
                      onClick={() => handleOptionClick(option)}
                    >
                      {option.id === 'contact' && <Mail className="h-4 w-4 mr-2 text-primary" />}
                      {option.label}
                    </Button>
                  ))}

                  {/* DEAD END HANDLER: If no sub-options exist, show Contact Support button */}
                  {(!currentOptions || currentOptions.length === 0) && contactOption && (
                    <Button 
                      key={contactOption.id} 
                      variant="outline"
                      // EXACT SAME CLASS AS ABOVE
                      className="justify-start text-left h-auto py-2 whitespace-normal hover:bg-slate-50"
                      onClick={() => handleOptionClick(contactOption)}
                    >
                      <Mail className="h-4 w-4 mr-2 text-primary" />
                      {contactOption.label}
                    </Button>
                  )}

                  {/* Navigation Controls */}
                  <div className="flex gap-2 mt-2">
                    {history.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                    )}
                    {history.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetChat} className="ml-auto text-muted-foreground">
                        Start Over
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <Button
        size="icon"
        // UPDATED: Added [&_svg]:size-10 to override the global button icon size limit
        className="h-16 w-16 rounded-full shadow-lg transition-transform hover:scale-105 [&_svg]:size-7"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}