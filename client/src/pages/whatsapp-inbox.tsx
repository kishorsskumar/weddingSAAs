import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X, Clock, FileText, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsappApproval {
  id: string;
  approvalCode: string;
  type: 'expense' | 'leave';
  requestId: string;
  employeeId: string;
  employeeName: string;
  description: string;
  amount?: string;
  mediaUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  approverPhone: string;
  sentAt: string;
  respondedAt?: string;
  responseMessage?: string;
  createdAt: string;
}

interface WhatsappInboundMessage {
  id: string;
  messageId: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  mediaUrl?: string;
  mediaContentType?: string;
  conversationId?: string;
  processedAt?: string;
  createdAt: string;
}

export default function WhatsappInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<WhatsappApproval | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const { data: pendingApprovals = [], isLoading: loadingPending, refetch: refetchPending } = useQuery<WhatsappApproval[]>({
    queryKey: ['/api/whatsapp/pending-approvals'],
  });

  const { data: allApprovals = [], isLoading: loadingAll, refetch: refetchAll } = useQuery<WhatsappApproval[]>({
    queryKey: ['/api/whatsapp/approvals'],
  });

  const { data: inboundMessages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery<WhatsappInboundMessage[]>({
    queryKey: ['/api/whatsapp/inbound-messages'],
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action, message }: { id: string; action: 'approve' | 'reject'; message?: string }) => {
      const response = await fetch(`/api/whatsapp/approvals/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, responseMessage: message }),
      });
      if (!response.ok) throw new Error('Failed to respond');
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === 'approve' ? 'Approved' : 'Rejected',
        description: `Request has been ${variables.action === 'approve' ? 'approved' : 'rejected'} and employee notified.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/approvals'] });
      setSelectedApproval(null);
      setResponseMessage('');
      setActionType(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to process request.', variant: 'destructive' });
    },
  });

  const handleAction = (approval: WhatsappApproval, action: 'approve' | 'reject') => {
    setSelectedApproval(approval);
    setActionType(action);
    setResponseMessage('');
  };

  const confirmAction = () => {
    if (selectedApproval && actionType) {
      respondMutation.mutate({
        id: selectedApproval.id,
        action: actionType,
        message: responseMessage || undefined,
      });
    }
  };

  const refreshAll = () => {
    refetchPending();
    refetchAll();
    refetchMessages();
    toast({ title: 'Refreshed', description: 'Data has been refreshed.' });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3 border-b bg-background sticky top-0 z-10">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            WhatsApp Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage employee requests via WhatsApp
          </p>
        </div>
        <Button onClick={refreshAll} variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="pending" className="relative min-h-[44px] text-xs sm:text-sm whitespace-nowrap">
            Pending
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="ml-1 sm:ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-[44px] text-xs sm:text-sm whitespace-nowrap">History</TabsTrigger>
          <TabsTrigger value="messages" className="min-h-[44px] text-xs sm:text-sm whitespace-nowrap">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {loadingPending ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending approvals</p>
                <p className="text-sm mt-1">Requests from employees will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingApprovals.map((approval) => (
                <Card key={approval.id} className="border-l-4 border-l-amber-500" data-testid={`approval-card-${approval.id}`}>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-1 sm:gap-2 flex-wrap">
                          {approval.type === 'expense' ? (
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                          ) : (
                            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{approval.approvalCode}</span>
                          <Badge variant="outline" className="text-xs">
                            {approval.type === 'expense' ? 'Expense' : 'Leave'}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                          {approval.employeeName} • {format(new Date(approval.sentAt), 'MMM d, h:mm a')}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 self-start flex-shrink-0">
                        Pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                    <p className="mb-2 sm:mb-3 text-sm sm:text-base">{approval.description}</p>
                    {approval.amount && (
                      <p className="text-base sm:text-lg font-semibold text-green-700 mb-2 sm:mb-3">₹{parseFloat(approval.amount).toLocaleString()}</p>
                    )}
                    {approval.mediaUrl && (
                      <a
                        href={approval.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:underline mb-2 sm:mb-3 min-h-[44px]"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Attachment
                      </a>
                    )}
                    <div className="flex gap-2 mt-3 sm:mt-4">
                      <Button
                        onClick={() => handleAction(approval, 'approve')}
                        className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none min-h-[44px]"
                        data-testid={`button-approve-${approval.id}`}
                      >
                        <Check className="h-4 w-4 mr-1 sm:mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleAction(approval, 'reject')}
                        variant="destructive"
                        className="flex-1 sm:flex-none min-h-[44px]"
                        data-testid={`button-reject-${approval.id}`}
                      >
                        <X className="h-4 w-4 mr-1 sm:mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 sm:mt-6">
          {loadingAll ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : allApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No approval history yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {allApprovals.map((approval) => (
                <Card key={approval.id} className={`border-l-4 ${
                  approval.status === 'approved' ? 'border-l-green-500' :
                  approval.status === 'rejected' ? 'border-l-red-500' :
                  'border-l-amber-500'
                }`}>
                  <CardContent className="p-3 sm:py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                        {approval.type === 'expense' ? (
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{approval.approvalCode} - {approval.employeeName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{approval.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:text-right gap-2 pl-6 sm:pl-0">
                        <Badge variant={
                          approval.status === 'approved' ? 'default' :
                          approval.status === 'rejected' ? 'destructive' : 'secondary'
                        } className={approval.status === 'approved' ? 'bg-green-600' : ''}>
                          {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(approval.sentAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-4 sm:mt-6">
          {loadingMessages ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : inboundMessages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages received yet</p>
                <p className="text-sm mt-1">WhatsApp messages will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {inboundMessages.map((msg) => (
                <Card key={msg.id}>
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{msg.fromNumber}</p>
                        <p className="text-sm break-words">{msg.body || '(Media message)'}</p>
                        {msg.mediaUrl && (
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center min-h-[44px]"
                          >
                            View attachment
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>

      <Dialog open={!!selectedApproval && !!actionType} onOpenChange={() => { setSelectedApproval(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval?.approvalCode} - {selectedApproval?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">{selectedApproval?.description}</p>
            <Textarea
              placeholder={actionType === 'reject' ? 'Reason for rejection (optional)...' : 'Add a comment (optional)...'}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              rows={3}
              data-testid="input-response-message"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedApproval(null); setActionType(null); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={respondMutation.isPending}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              data-testid="button-confirm-action"
            >
              {respondMutation.isPending ? 'Processing...' : actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
