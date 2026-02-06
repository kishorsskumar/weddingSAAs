import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, 
  Presentation, 
  FileSignature, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Download,
  Eye,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";

interface PortalData {
  id: string;
  name: string;
  email: string;
  eventDate: string | null;
  eventType: string | null;
  venue: string | null;
  phase: string;
  clientApprovalStatus: string;
  clientApprovalNotes: string | null;
  documentsSharedAt: string | null;
  estimate: {
    id: string;
    estimateNumber: string;
    title: string;
    total: string;
    lineItems: any[];
    terms: string | null;
    status: string;
  } | null;
  presentation: {
    id: string;
    title: string;
    slides: any[];
  } | null;
  contractUrl: string | null;
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | 'revision_requested'>('approved');
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showEstimateDetail, setShowEstimateDetail] = useState(false);

  const { data: portal, isLoading, error } = useQuery<PortalData>({
    queryKey: ['client-portal', token],
    queryFn: async () => {
      const res = await fetch(`/api/client-portal/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load portal');
      }
      return res.json();
    },
    enabled: !!token,
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: { status: string; notes: string }) => {
      const res = await fetch(`/api/client-portal/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit approval');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portal', token] });
      setShowApprovalDialog(false);
      toast({
        title: approvalAction === 'approved' ? 'Documents Approved!' : 
               approvalAction === 'rejected' ? 'Documents Rejected' : 'Revision Requested',
        description: approvalAction === 'approved' 
          ? 'Thank you for approving. Your wedding planner will be in touch shortly.'
          : 'Your feedback has been sent to your wedding planner.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit your response. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleApproval = (action: 'approved' | 'rejected' | 'revision_requested') => {
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const submitApproval = () => {
    approvalMutation.mutate({
      status: approvalAction,
      notes: approvalNotes,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4b7c29]/5 to-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29] mx-auto mb-4" />
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Portal Not Found</CardTitle>
            <CardDescription>
              This portal link may have expired or is invalid. Please contact your wedding planner for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getApprovalStatusBadge = () => {
    switch (portal.clientApprovalStatus) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'revision_requested':
        return <Badge className="bg-yellow-100 text-yellow-800"><MessageSquare className="w-3 h-3 mr-1" /> Revision Requested</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Awaiting Your Review</Badge>;
    }
  };

  const hasDocuments = portal.estimate || portal.presentation || portal.contractUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4b7c29]/5 to-white">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <img src="/oak-street-logo.png" alt="Oakstreet Events" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-semibold text-[#4b7c29]">Oakstreet Events</h1>
              <p className="text-sm text-gray-500">Client Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Welcome, {portal.name}!</CardTitle>
                <CardDescription className="mt-2">
                  Your wedding planner has shared documents for your review and approval.
                </CardDescription>
              </div>
              {getApprovalStatusBadge()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {portal.eventDate && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(portal.eventDate), 'MMMM d, yyyy')}</span>
                </div>
              )}
              {portal.eventType && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span className="capitalize">{portal.eventType.replace(/_/g, ' ')}</span>
                </div>
              )}
              {portal.venue && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{portal.venue}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!hasDocuments ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Documents Coming Soon</h3>
              <p className="text-gray-500">
                Your wedding planner is preparing your documents. You'll receive a notification when they're ready for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 mb-8">
              {portal.estimate && (
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Estimate</CardTitle>
                          <CardDescription>{portal.estimate.estimateNumber}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#4b7c29]">
                          ₹{parseFloat(portal.estimate.total).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{portal.estimate.title}</p>
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto"
                      onClick={() => setShowEstimateDetail(true)}
                    >
                      <Eye className="w-4 h-4 mr-2" /> View Full Estimate
                    </Button>
                  </CardContent>
                </Card>
              )}

              {portal.presentation && (
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Presentation className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Presentation</CardTitle>
                          <CardDescription>{portal.presentation.slides?.length || 0} slides</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{portal.presentation.title}</p>
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto"
                      onClick={() => window.open(`/presentations/${portal.presentation?.id}/view`, '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-2" /> View Presentation
                    </Button>
                  </CardContent>
                </Card>
              )}

              {portal.contractUrl && (
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileSignature className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Contract</CardTitle>
                        <CardDescription>Review and sign your agreement</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto"
                      onClick={() => window.open(portal.contractUrl!, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> View Contract
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {portal.clientApprovalStatus === 'pending' && (
              <Card className="border-[#4b7c29]/20 bg-[#4b7c29]/5">
                <CardHeader>
                  <CardTitle>Ready to Proceed?</CardTitle>
                  <CardDescription>
                    Review all documents above and let us know if you're ready to move forward.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      className="bg-[#4b7c29] hover:bg-[#4b7c29]/90 flex-1"
                      onClick={() => handleApproval('approved')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve All Documents
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleApproval('revision_requested')}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Request Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {portal.clientApprovalStatus !== 'pending' && (
              <Card className={
                portal.clientApprovalStatus === 'approved' ? 'border-green-200 bg-green-50' :
                portal.clientApprovalStatus === 'rejected' ? 'border-red-200 bg-red-50' :
                'border-yellow-200 bg-yellow-50'
              }>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {portal.clientApprovalStatus === 'approved' && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                    {portal.clientApprovalStatus === 'rejected' && <XCircle className="w-6 h-6 text-red-600" />}
                    {portal.clientApprovalStatus === 'revision_requested' && <MessageSquare className="w-6 h-6 text-yellow-600" />}
                    <div>
                      <CardTitle>
                        {portal.clientApprovalStatus === 'approved' && 'Documents Approved'}
                        {portal.clientApprovalStatus === 'rejected' && 'Documents Rejected'}
                        {portal.clientApprovalStatus === 'revision_requested' && 'Revision Requested'}
                      </CardTitle>
                      <CardDescription>
                        {portal.clientApprovalNotes && `Your notes: "${portal.clientApprovalNotes}"`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {portal.clientApprovalStatus === 'approved' && 'Thank you! Your wedding planner will contact you soon with next steps.'}
                    {portal.clientApprovalStatus === 'rejected' && 'Your wedding planner will review your feedback and get back to you.'}
                    {portal.clientApprovalStatus === 'revision_requested' && 'Your wedding planner is working on the requested changes.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approved' && 'Confirm Approval'}
              {approvalAction === 'rejected' && 'Reject Documents'}
              {approvalAction === 'revision_requested' && 'Request Changes'}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approved' && 'By approving, you confirm that you have reviewed and agree to the estimate, presentation, and/or contract.'}
              {approvalAction === 'rejected' && 'Please let us know why you are rejecting these documents.'}
              {approvalAction === 'revision_requested' && 'Please describe what changes you would like us to make.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={
                approvalAction === 'approved' ? 'Any additional comments (optional)...' :
                'Please describe your concerns or requested changes...'
              }
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={submitApproval}
              disabled={approvalMutation.isPending}
              className={
                approvalAction === 'approved' ? 'bg-[#4b7c29] hover:bg-[#4b7c29]/90' :
                approvalAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                'bg-yellow-600 hover:bg-yellow-700'
              }
            >
              {approvalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {approvalAction === 'approved' && 'Approve'}
              {approvalAction === 'rejected' && 'Reject'}
              {approvalAction === 'revision_requested' && 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEstimateDetail} onOpenChange={setShowEstimateDetail}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estimate Details</DialogTitle>
            <DialogDescription>{portal.estimate?.estimateNumber}</DialogDescription>
          </DialogHeader>
          {portal.estimate && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Qty</th>
                      <th className="text-right p-3 font-medium">Rate</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portal.estimate.lineItems?.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.description || item.name}</td>
                        <td className="p-3 text-right">{item.quantity || 1}</td>
                        <td className="p-3 text-right">₹{parseFloat(item.rate || item.price || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right">₹{parseFloat(item.amount || item.total || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-medium">
                    <tr>
                      <td colSpan={3} className="p-3 text-right">Total</td>
                      <td className="p-3 text-right text-lg text-[#4b7c29]">
                        ₹{parseFloat(portal.estimate.total).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {portal.estimate.terms && (
                <div>
                  <h4 className="font-medium mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{portal.estimate.terms}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Oakstreet Events. All rights reserved.</p>
          <p className="mt-1">Questions? Contact your wedding planner or email us at hello@oakstreetevent.com</p>
        </div>
      </footer>
    </div>
  );
}
