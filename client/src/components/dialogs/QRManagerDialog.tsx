import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@clerk/clerk-react";
import { QrCode, Loader2, ExternalLink, Edit2, Check, X, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type QrCodeData = {
  id: string;
  destinationUrl: string;
  scanCount: number;
  createdAt: string;
};

export function QRManagerDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [codes, setCodes] = useState<QrCodeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const { getToken } = useAuth();
  const { toast } = useToast();

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/qrcodes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCodes(await res.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/qrcodes/${id}`, {
        method: "PUT",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ destinationUrl: editUrl })
      });

      if (!res.ok) throw new Error();

      toast({ title: "Updated", description: "Destination URL updated successfully." });
      setEditingId(null);
      fetchCodes(); // Refresh list
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update URL" });
    }
  };

  useEffect(() => {
    if (isOpen) fetchCodes();
  }, [isOpen]);

  // Determine the base URL to display (Production vs Local)
  const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <QrCode className="h-4 w-4" />
          QR Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dynamic QR Codes</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No dynamic QR codes created yet. Select a QR element and click "Convert to Dynamic URL".
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Short Link</TableHead>
                <TableHead>Destination URL</TableHead>
                <TableHead className="text-right">Scans</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id}>
                  {/* DISPLAY LOGIC: Uses VITE_APP_BASE_URL if set, else current window origin */}
                  <TableCell className="font-mono text-xs">
                    {baseUrl}/q/{code.id}
                  </TableCell>
                  <TableCell>
                    {editingId === code.id ? (
                      <Input 
                        value={editUrl} 
                        onChange={(e) => setEditUrl(e.target.value)} 
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-2 max-w-[300px] truncate text-sm text-muted-foreground">
                        {code.destinationUrl}
                        <a href={code.destinationUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 hover:text-primary" />
                        </a>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        {code.scanCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingId === code.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleUpdate(code.id)}>
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => {
                            setEditingId(code.id);
                            setEditUrl(code.destinationUrl);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}