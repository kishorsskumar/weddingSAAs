import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Bot, Save, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AiSettings {
  id: string;
  companyId: string;
  assistantName: string;
  welcomeMessage: string | null;
  systemPromptAddition: string | null;
  avatarUrl: string | null;
  primaryColor: string | null;
  monthlyTokenLimit: number;
  isEnabled: boolean;
}

interface AiUsage {
  tokensUsed: number;
  tokenLimit: number;
  percentageUsed: number;
  resetsAt: string;
}

export function AiSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<AiSettings>>({});

  const { data: settings, isLoading: settingsLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setFormData(data);
      return data;
    },
  });

  const { data: usage, isLoading: usageLoading } = useQuery<AiUsage>({
    queryKey: ["/api/ai/usage"],
    queryFn: async () => {
      const res = await fetch("/api/ai/usage", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AiSettings>) => {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your AI assistant settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const isLoading = settingsLoading || usageLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Usage This Month
          </CardTitle>
          <CardDescription>Track your AI assistant token usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{usage?.tokensUsed?.toLocaleString() || 0} tokens used</span>
              <span>{usage?.tokenLimit?.toLocaleString() || 50000} token limit</span>
            </div>
            <Progress value={usage?.percentageUsed || 0} className="h-2" />
            <p className="text-xs text-gray-500">
              Resets on {usage?.resetsAt ? new Date(usage.resetsAt).toLocaleDateString() : 'first of next month'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                White-Label AI Assistant
              </CardTitle>
              <CardDescription>
                Customize your AI assistant's name and appearance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-enabled">Enabled</Label>
              <Switch
                id="ai-enabled"
                checked={formData.isEnabled ?? true}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, isEnabled: checked }))
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assistant-name">Assistant Name</Label>
              <Input
                id="assistant-name"
                value={formData.assistantName || ""}
                onChange={(e) => 
                  setFormData(prev => ({ ...prev, assistantName: e.target.value }))
                }
                placeholder="e.g., Wedding AI, Your Brand Assistant"
              />
              <p className="text-xs text-gray-500">
                This name will appear in chat headers and messages
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar-url">Avatar URL (Optional)</Label>
              <Input
                id="avatar-url"
                value={formData.avatarUrl || ""}
                onChange={(e) => 
                  setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))
                }
                placeholder="https://example.com/avatar.png"
              />
              <p className="text-xs text-gray-500">
                Custom avatar image for your assistant
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-message">Welcome Message</Label>
            <Textarea
              id="welcome-message"
              value={formData.welcomeMessage || ""}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))
              }
              placeholder="Hello! How can I help with your wedding planning today?"
              rows={2}
            />
            <p className="text-xs text-gray-500">
              First message shown when users start a new conversation
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt">Custom Instructions (Optional)</Label>
            <Textarea
              id="system-prompt"
              value={formData.systemPromptAddition || ""}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, systemPromptAddition: e.target.value }))
              }
              placeholder="Add custom instructions for how the AI should behave..."
              rows={4}
            />
            <p className="text-xs text-gray-500">
              Additional instructions to customize AI behavior for your business
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="primary-color"
                type="color"
                value={formData.primaryColor || "#5B8C51"}
                onChange={(e) => 
                  setFormData(prev => ({ ...prev, primaryColor: e.target.value }))
                }
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                value={formData.primaryColor || "#5B8C51"}
                onChange={(e) => 
                  setFormData(prev => ({ ...prev, primaryColor: e.target.value }))
                }
                placeholder="#5B8C51"
                className="w-32"
              />
              <p className="text-xs text-gray-500">
                Color used for AI message bubbles
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Preview</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: formData.primaryColor || '#5B8C51' }}
                >
                  {formData.avatarUrl ? (
                    <img 
                      src={formData.avatarUrl} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {formData.assistantName || 'Wedding AI'}
                    <Badge variant="secondary" className="text-xs">AI</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {formData.welcomeMessage || 'Hello! How can I help with your wedding planning today?'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
