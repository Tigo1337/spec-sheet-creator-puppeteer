import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LayoutTemplate, ArrowRight } from "lucide-react";
import type { Template } from "@shared/schema";

export default function TemplateLibrary() {
  const [, setLocation] = useLocation();

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["public-templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <PublicHeader />

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            Template <span className="text-[#2A9D90]">Library</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Browse our collection of professional, print-ready templates designed for variable data automation.
          </p>
        </div>
      </section>

      {/* Grid Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#2A9D90]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {templates?.map((template) => (
                <Card key={template.id} className="flex flex-col overflow-hidden hover:shadow-xl transition-shadow border-slate-200 bg-white group">

                  {/* Preview Area - Styled to look like the Editor Workspace */}
                  <div className="w-full bg-slate-100/50 border-b border-slate-100 p-6 flex items-center justify-center">
                    <div 
                      className="relative shadow-lg bg-white transition-transform duration-300 group-hover:scale-[1.01]"
                      style={{ 
                        // Dynamically set aspect ratio to match the template dimensions
                        aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
                        width: '100%',
                      }}
                    >
                      {template.previewImages && template.previewImages.length > 0 ? (
                        <img 
                          src={template.previewImages[0]} 
                          alt={template.name}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div 
                          className="w-full h-full flex flex-col items-center justify-center text-slate-400"
                          style={{ backgroundColor: template.backgroundColor || '#ffffff' }}
                        >
                          <LayoutTemplate size={32} className="mb-2 opacity-20" />
                          <span className="text-xs">No Preview</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-lg font-bold text-slate-900">{template.name}</CardTitle>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 shrink-0">
                        {template.pageCount} {template.pageCount === 1 ? 'Page' : 'Pages'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <p className="text-sm text-slate-500 line-clamp-3">
                      {template.description || "A professional template ready for your data."}
                    </p>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between text-[#2A9D90] hover:text-[#238b80] hover:bg-[#2A9D90]/5 group/btn"
                      onClick={() => setLocation("/registration")}
                    >
                      Use Template
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && templates?.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <p>No templates found. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}